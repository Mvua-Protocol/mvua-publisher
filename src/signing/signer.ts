/**
 * ed25519 signing of an observation payload (P2.1.1).
 *
 * The publisher signing key is a raw 32-byte ed25519 seed, distinct from any
 * Stellar account. Its 32-byte public key is what the guardian registers in the
 * `oracle-adapter` publisher registry (`propose_publisher`/`execute_publisher`),
 * and the contract verifies each submission against it. The transaction that
 * carries the submission is paid for by a separate account (see submit.ts);
 * `submit` does not use `require_auth`, so this key never signs a Stellar
 * transaction envelope.
 */
import nacl from "tweetnacl";

/** A publisher identity: the ed25519 keypair used to sign observations. */
export interface PublisherKeypair {
  /** 32-byte public key, registered on chain as `BytesN<32>`. */
  readonly publicKey: Buffer;
  /** 64-byte secret key (seed + public), kept in memory only. */
  readonly secretKey: Buffer;
}

/** Thrown when key material is malformed. */
export class SigningError extends Error {}

/** Derive a publisher keypair from a 32-byte seed given as 64 hex characters. */
export function keypairFromSeedHex(seedHex: string): PublisherKeypair {
  const cleaned = seedHex.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(cleaned)) {
    throw new SigningError("publisher seed must be 64 hex characters (32 bytes)");
  }
  const seed = Buffer.from(cleaned, "hex");
  const pair = nacl.sign.keyPair.fromSeed(seed);
  return {
    publicKey: Buffer.from(pair.publicKey),
    secretKey: Buffer.from(pair.secretKey),
  };
}

/**
 * Sign the payload XDR bytes, returning the 64-byte detached signature the
 * contract expects as its `BytesN<64>` argument.
 */
export function signPayload(message: Buffer, secretKey: Buffer): Buffer {
  if (secretKey.length !== nacl.sign.secretKeyLength) {
    throw new SigningError(`secret key must be ${nacl.sign.secretKeyLength} bytes`);
  }
  const sig = nacl.sign.detached(new Uint8Array(message), new Uint8Array(secretKey));
  return Buffer.from(sig);
}
