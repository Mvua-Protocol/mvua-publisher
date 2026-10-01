/**
 * Golden fixture for the observation payload XDR (P2.1.3).
 *
 * The bytes we sign MUST equal what the `oracle-adapter` contract reconstructs
 * with `payload.to_xdr(&env)`. This test does two things:
 *
 *  1. Structural checks that always run: the encoding is a 4-entry ScVal map
 *     with keys in the contract's sorted order and the right native values.
 *  2. A byte-for-byte equality check against a Rust reference, when present.
 *
 * To generate the reference, run this once inside the `mvua-contract` workspace
 * and paste the hex into `test/fixtures/observation.xdr.hex`:
 *
 * ```rust
 * // in a throwaway #[test] in oracle-adapter (uses soroban_sdk::xdr::ToXdr):
 * let env = Env::default();
 * let payload = ObservationPayload {
 *     region: Symbol::new(&env, "kilifi"),
 *     metric: Symbol::new(&env, "rain_mm"),
 *     timestamp: 1_700_000_000u64,
 *     value: 1234i128,
 * };
 * let bytes = payload.to_xdr(&env);
 * let mut out = std::string::String::new();
 * for b in bytes.iter() { out.push_str(&std::format!("{:02x}", b)); }
 * std::println!("{out}");
 * ```
 *
 * If the equality check fails, the encoder in src/schema/observation.ts must be
 * corrected to match the contract (most likely the FIELD_ORDER constant).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";
import { scValToNative, xdr } from "@stellar/stellar-sdk";
import {
  encodeObservationPayloadXdr,
  observationScVal,
  type ObservationInput,
} from "../src/schema/observation.js";

const FIXTURE: ObservationInput = {
  region: "kilifi",
  metric: "rain_mm",
  timestamp: 1_700_000_000n,
  value: 1234n,
};

const here = dirname(fileURLToPath(import.meta.url));
const referencePath = join(here, "fixtures", "observation.xdr.hex");

function readReferenceHex(): string | undefined {
  try {
    const raw = readFileSync(referencePath, "utf8").trim().toLowerCase();
    return raw.length > 0 ? raw : undefined;
  } catch {
    return undefined;
  }
}

void test("payload encodes as a 4-entry map with contract-sorted keys", () => {
  const sv = observationScVal(FIXTURE);
  assert.equal(sv.switch().name, "scvMap");
  const map = sv.map();
  assert.ok(map);
  const keys = map.map((e) => e.key().sym().toString());
  assert.deepEqual(keys, ["metric", "region", "timestamp", "value"]);
});

void test("payload round-trips to the expected native values", () => {
  const buf = encodeObservationPayloadXdr(FIXTURE);
  const decoded = scValToNative(xdr.ScVal.fromXDR(buf)) as Record<string, unknown>;
  assert.equal(decoded.region, "kilifi");
  assert.equal(decoded.metric, "rain_mm");
  assert.equal(BigInt(decoded.timestamp as bigint), 1_700_000_000n);
  assert.equal(BigInt(decoded.value as bigint), 1234n);
});

void test("payload XDR matches the Rust to_xdr reference", { skip: readReferenceHex() === undefined }, () => {
  const expected = readReferenceHex();
  const actual = encodeObservationPayloadXdr(FIXTURE).toString("hex");
  assert.equal(actual, expected);
});
