/**
 * Submit a signed observation to `oracle-adapter.submit` on Soroban (P2.1.1).
 *
 * `submit(region, metric, timestamp, value, publisher, signature)` authenticates
 * by the ed25519 signature over the payload XDR, not by `require_auth`. So the
 * transaction source here only pays the fee and provides a sequence number; it
 * is deliberately a different account from the publisher signing identity.
 */
import {
  BASE_FEE,
  Contract,
  Keypair,
  nativeToScVal,
  rpc,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import type { Logger } from "./logger.js";

export class SubmitError extends Error {}

export interface SubmitParams {
  readonly rpcUrl: string;
  readonly networkPassphrase: string;
  readonly allowHttp: boolean;
  readonly oracleContractId: string;
  /** Secret key (S...) of the fee-paying transaction source. */
  readonly submitterSecret: string;
  readonly region: string;
  readonly metric: string;
  readonly timestamp: bigint;
  readonly value: bigint;
  /** 32-byte publisher public key. */
  readonly publisher: Buffer;
  /** 64-byte detached ed25519 signature over the payload XDR. */
  readonly signature: Buffer;
}

export interface SubmitResult {
  /** Transaction hash, or null when the oracle already holds this observation. */
  readonly hash: string | null;
}

/**
 * True if the oracle rejected the observation as a replay (`ReplayedObservation`,
 * contract error 309, DR-0035): this publisher already has an observation at or
 * after this timestamp, typically because an earlier attempt landed.
 */
export function isReplayRejection(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /Error\(Contract, #309\)/.test(message);
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function buildArgs(p: SubmitParams): xdr.ScVal[] {
  return [
    xdr.ScVal.scvSymbol(p.region),
    xdr.ScVal.scvSymbol(p.metric),
    xdr.ScVal.scvU64(xdr.Uint64.fromString(p.timestamp.toString())),
    nativeToScVal(p.value, { type: "i128" }),
    xdr.ScVal.scvBytes(p.publisher),
    xdr.ScVal.scvBytes(p.signature),
  ];
}

/** Build, simulate, sign, send, and confirm the submission transaction. */
export async function submitObservation(p: SubmitParams, log: Logger): Promise<SubmitResult> {
  const server = new rpc.Server(p.rpcUrl, { allowHttp: p.allowHttp });
  const source = Keypair.fromSecret(p.submitterSecret);
  const account = await server.getAccount(source.publicKey());
  const contract = new Contract(p.oracleContractId);

  const built = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: p.networkPassphrase,
  })
    .addOperation(contract.call("submit", ...buildArgs(p)))
    .setTimeout(30)
    .build();

  let prepared;
  try {
    prepared = await server.prepareTransaction(built);
  } catch (err) {
    // Simulation fails with the contract error before anything is sent.
    if (isReplayRejection(err)) return { hash: null };
    throw err;
  }
  prepared.sign(source);

  const sent = await server.sendTransaction(prepared);
  if (sent.status === "ERROR") {
    throw new SubmitError(`sendTransaction failed: ${JSON.stringify(sent.errorResult)}`);
  }
  log.info("submission sent", { hash: sent.hash });

  let attempts = 0;
  let got = await server.getTransaction(sent.hash);
  while (got.status === rpc.Api.GetTransactionStatus.NOT_FOUND && attempts < 30) {
    await sleep(1000);
    attempts += 1;
    got = await server.getTransaction(sent.hash);
  }
  if (got.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new SubmitError(`transaction ${sent.hash} did not succeed: ${got.status}`);
  }
  return { hash: sent.hash };
}
