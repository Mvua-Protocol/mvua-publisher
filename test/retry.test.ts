/**
 * Retry and duplicate-safety checks (P2.2.1): transient failures are retried
 * with backoff, persistent ones still surface, and the oracle's replay
 * rejection is recognized so a retried submission counts as done.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Logger } from "../src/logger.js";
import { withRetry } from "../src/retry.js";
import { isReplayRejection } from "../src/submit.js";

const silent: Logger = { debug() {}, info() {}, warn() {}, error() {} };

void test("withRetry returns once a flaky call succeeds", async () => {
  let calls = 0;
  const value = await withRetry(
    "flaky",
    () => {
      calls += 1;
      return calls < 3 ? Promise.reject(new Error("HTTP 503")) : Promise.resolve(42);
    },
    silent,
    4,
    0,
  );
  assert.equal(value, 42);
  assert.equal(calls, 3);
});

void test("withRetry rethrows the last error after the final attempt", async () => {
  let calls = 0;
  await assert.rejects(
    withRetry(
      "down",
      () => {
        calls += 1;
        return Promise.reject(new Error(`attempt ${calls}`));
      },
      silent,
      3,
      0,
    ),
    /attempt 3/,
  );
  assert.equal(calls, 3);
});

void test("isReplayRejection matches only the oracle's ReplayedObservation error", () => {
  const sim = "HostError: Error(Contract, #309)\n\nEvent log (newest first): ...";
  assert.equal(isReplayRejection(new Error(sim)), true);
  assert.equal(isReplayRejection(new Error("HostError: Error(Contract, #308)")), false);
  assert.equal(isReplayRejection(new Error("HostError: Error(Contract, #3090)")), false);
  assert.equal(isReplayRejection("network timeout"), false);
});
