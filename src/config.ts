/**
 * Startup configuration and secret handling (P2.1.2 seed).
 *
 * Every environment variable is validated here with zod. If anything required
 * is missing or malformed the process throws before doing any work, so the
 * service can never submit on a half-configured run. Load the env with Node's
 * built-in `--env-file=.env` (see package.json scripts); this module only reads
 * `process.env`.
 *
 * Secrets (the publisher seed and the submitter secret) are read into typed
 * fields and never logged. Do not add them to any log call.
 */
import { z } from "zod";
import type { LogLevel } from "./logger.js";

const symbol = z.string().regex(/^[A-Za-z0-9_]{1,32}$/, "must be 1-32 chars of [A-Za-z0-9_]");

const schema = z.object({
  MVUA_NETWORK: z.enum(["testnet", "futurenet", "local"]).default("testnet"),
  MVUA_RPC_URL: z.string().url(),
  MVUA_NETWORK_PASSPHRASE: z.string().min(1),

  MVUA_ORACLE_CONTRACT_ID: z.string().regex(/^C[A-Z2-7]{55}$/, "expected a C... contract id"),

  MVUA_PUBLISHER_SEED_HEX: z.string().regex(/^[0-9a-fA-F]{64}$/, "expected 64 hex chars"),
  MVUA_SUBMITTER_SECRET: z.string().regex(/^S[A-Z2-7]{55}$/, "expected an S... secret key"),

  MVUA_REGION: symbol,
  MVUA_METRIC: symbol,

  MVUA_LATITUDE: z.coerce.number().min(-90).max(90),
  MVUA_LONGITUDE: z.coerce.number().min(-180).max(180),
  MVUA_NOAA_STATION_ID: z.string().min(1),
  MVUA_NOAA_TOKEN: z.string().min(1),

  MVUA_VALUE_SCALE: z.coerce.number().int().positive().default(100),
  MVUA_MAX_SOURCE_DELTA: z.coerce.bigint().nonnegative().default(500n),

  MVUA_LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

/** The validated, typed configuration. */
export interface Config {
  readonly network: string;
  readonly rpcUrl: string;
  readonly networkPassphrase: string;
  readonly oracleContractId: string;
  readonly publisherSeedHex: string;
  readonly submitterSecret: string;
  readonly region: string;
  readonly metric: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly noaaStationId: string;
  readonly noaaToken: string;
  readonly valueScale: number;
  readonly maxSourceDelta: bigint;
  readonly logLevel: LogLevel;
}

/** Thrown when the environment is not a valid configuration. */
export class ConfigError extends Error {}

/** Parse and validate `process.env` into a `Config`, or throw `ConfigError`. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new ConfigError(`invalid configuration:\n${issues}`);
  }
  const c = parsed.data;
  return {
    network: c.MVUA_NETWORK,
    rpcUrl: c.MVUA_RPC_URL,
    networkPassphrase: c.MVUA_NETWORK_PASSPHRASE,
    oracleContractId: c.MVUA_ORACLE_CONTRACT_ID,
    publisherSeedHex: c.MVUA_PUBLISHER_SEED_HEX,
    submitterSecret: c.MVUA_SUBMITTER_SECRET,
    region: c.MVUA_REGION,
    metric: c.MVUA_METRIC,
    latitude: c.MVUA_LATITUDE,
    longitude: c.MVUA_LONGITUDE,
    noaaStationId: c.MVUA_NOAA_STATION_ID,
    noaaToken: c.MVUA_NOAA_TOKEN,
    valueScale: c.MVUA_VALUE_SCALE,
    maxSourceDelta: c.MVUA_MAX_SOURCE_DELTA,
    logLevel: c.MVUA_LOG_LEVEL,
  };
}
