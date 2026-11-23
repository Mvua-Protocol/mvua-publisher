import assert from "node:assert/strict";
import { test } from "node:test";
import type { ObservationCache } from "../src/cache.js";
import { uptimeReport } from "../src/status.js";

const done = (hash: string | null = "h") => ({ value: "0", timestamp: "0", hash });

void test("uptimeReport counts submitted days and lists missed ones", () => {
  const cache: ObservationCache = {
    "2026-11-18": done(),
    "2026-11-19": done(null), // the oracle already had it: still submitted
    "2026-11-21": { value: "0", timestamp: "0" }, // cached but not submitted
    "2026-11-22": done(),
  };
  const r = uptimeReport(cache, "2026-11-22", 30);
  // The window starts at the first cached day, not 30 days back.
  assert.equal(r.from, "2026-11-18");
  assert.equal(r.days, 5);
  assert.equal(r.submitted, 3);
  assert.deepEqual(r.missed, ["2026-11-20", "2026-11-21"]);
  assert.equal(r.uptimePct, 60);
  assert.equal(r.meetsTarget, false);
  assert.equal(r.lastSubmitted, "2026-11-22");
});

void test("uptimeReport meets the target when every day is in", () => {
  const cache: ObservationCache = {};
  for (let d = 1; d <= 30; d += 1) cache[`2026-11-${String(d).padStart(2, "0")}`] = done();
  const r = uptimeReport(cache, "2026-11-30", 7);
  assert.deepEqual(
    [r.from, r.days, r.submitted, r.uptimePct, r.meetsTarget],
    ["2026-11-24", 7, 7, 100, true],
  );
});

void test("uptimeReport on an empty cache reports nothing submitted", () => {
  const r = uptimeReport({}, "2026-11-30", 3);
  assert.deepEqual([r.days, r.submitted, r.lastSubmitted, r.meetsTarget], [3, 0, null, false]);
});
