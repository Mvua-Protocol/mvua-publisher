/**
 * The observation payload schema, shared in spirit with the on-chain
 * `oracle-adapter` contract (P2.1.3).
 *
 * The contract authenticates each submission by verifying an ed25519 signature
 * over the XDR of its `#[contracttype]` struct:
 *
 * ```rust
 * pub struct ObservationPayload {
 *     pub region: Symbol,
 *     pub metric: Symbol,
 *     pub timestamp: u64,
 *     pub value: i128,
 * }
 * ```
 *
 * A `#[contracttype]` struct is represented on the host as an ordered `ScMap`
 * whose keys are the field-name `Symbol`s, so `to_xdr` emits the entries sorted
 * by key. This module reconstructs that exact `ScVal` and serializes it, so the
 * bytes we sign here are byte-for-byte what the contract reconstructs and
 * verifies. Any drift here silently breaks every submission, which is why
 * `test/observation.xdr.test.ts` pins the output against a Rust `to_xdr`
 * reference.
 */
import { nativeToScVal, xdr } from "@stellar/stellar-sdk";

/** A Soroban Symbol: 1..=32 characters from [a-zA-Z0-9_]. */
const SYMBOL_RE = /^[A-Za-z0-9_]{1,32}$/;

/** i128 bounds, used to reject a value that could not round-trip on chain. */
const I128_MIN = -(2n ** 127n);
const I128_MAX = 2n ** 127n - 1n;

/**
 * The map-key order the contract emits. Because the host stores a struct as an
 * `ScMap` sorted by its `Symbol` keys, the serialized order is alphabetical by
 * field name, not declaration order: metric, region, timestamp, value.
 *
 * This is the single most likely point of divergence from the contract. It is
 * isolated here on purpose: if the golden fixture disagrees, the fix is to
 * reorder this list, nothing else.
 */
const FIELD_ORDER = ["metric", "region", "timestamp", "value"] as const;

/** The fields of an observation, before XDR encoding. */
export interface ObservationInput {
  /** Region Symbol, must match the consuming index definition exactly. */
  readonly region: string;
  /** Metric Symbol, must match the consuming index definition exactly. */
  readonly metric: string;
  /** Unix seconds of the observation. Must not be in the future on chain. */
  readonly timestamp: bigint;
  /** The scaled integer value (see MVUA_VALUE_SCALE). Must be >= 0 on chain. */
  readonly value: bigint;
}

/** Thrown when an input cannot be a valid on-chain observation. */
export class ObservationSchemaError extends Error {}

function assertSymbol(name: string, value: string): void {
  if (!SYMBOL_RE.test(value)) {
    throw new ObservationSchemaError(
      `${name} must be 1-32 chars of [A-Za-z0-9_]; got ${JSON.stringify(value)}`,
    );
  }
}

/** Validate an input against the contract's acceptance rules (fail closed). */
export function assertValidObservation(input: ObservationInput): void {
  assertSymbol("region", input.region);
  assertSymbol("metric", input.metric);
  if (input.timestamp < 0n) {
    throw new ObservationSchemaError("timestamp must be non-negative");
  }
  // The contract rejects a negative value with InvalidObservation (308).
  if (input.value < 0n) {
    throw new ObservationSchemaError("value must be non-negative");
  }
  if (input.value < I128_MIN || input.value > I128_MAX) {
    throw new ObservationSchemaError("value does not fit in i128");
  }
}

/** Build the `ScVal` for a single field. */
function fieldScVal(field: (typeof FIELD_ORDER)[number], input: ObservationInput): xdr.ScVal {
  switch (field) {
    case "region":
      return xdr.ScVal.scvSymbol(input.region);
    case "metric":
      return xdr.ScVal.scvSymbol(input.metric);
    case "timestamp":
      return xdr.ScVal.scvU64(xdr.Uint64.fromString(input.timestamp.toString()));
    case "value":
      return nativeToScVal(input.value, { type: "i128" });
  }
}

/**
 * Reconstruct the payload as the contract's sorted `ScMap` `ScVal`.
 * Exposed for the golden fixture test.
 */
export function observationScVal(input: ObservationInput): xdr.ScVal {
  assertValidObservation(input);
  const entries = FIELD_ORDER.map(
    (field) =>
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol(field),
        val: fieldScVal(field, input),
      }),
  );
  return xdr.ScVal.scvMap(entries);
}

/**
 * The exact bytes the contract signs and verifies: the XDR of the payload
 * `ScVal`. This is the message passed to ed25519 signing and, unchanged, is
 * what `oracle-adapter.submit` reconstructs via `payload.to_xdr(&env)`.
 */
export function encodeObservationPayloadXdr(input: ObservationInput): Buffer {
  // v17's XdrValue.toXdr() returns a Uint8Array; we keep a Buffer at the
  // boundary so callers can sign it and the fixture test can .toString("hex").
  return Buffer.from(observationScVal(input).toXdr());
}
