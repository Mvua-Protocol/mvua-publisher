/**
 * Observation cache checks (P2.2.2): the cache survives a restart (file round
 * trip), a missing file is an empty cache, and replay submits pending days
 * oldest first before the new day, skipping anything already submitted.
 */
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  datesToSubmit,
  loadCache,
  missedDays,
  saveCache,
  type ObservationCache,
} from "../src/cache.js";

void test("cache round-trips through the file and starts empty when missing", () => {
  const path = join(mkdtempSync(join(tmpdir(), "mvua-cache-")), "nested", "KE_NAK-rain_mm.json");
  assert.deepEqual(loadCache(path), {});

  const cache: ObservationCache = {
    "2026-11-01": { value: "130", timestamp: "1793534400", hash: "abc" },
    "2026-11-02": { value: "0", timestamp: "1793620800" },
  };
  saveCache(path, cache);
  assert.deepEqual(loadCache(path), cache);
});

void test("datesToSubmit replays pending days oldest first, then the new day", () => {
  const cache: ObservationCache = {
    "2026-11-03": { value: "5", timestamp: "3" },
    "2026-11-01": { value: "1", timestamp: "1" },
    "2026-11-02": { value: "2", timestamp: "2", hash: "done" },
    "2026-11-04": { value: "4", timestamp: "4", hash: null },
  };
  assert.deepEqual(datesToSubmit(cache, "2026-11-05"), ["2026-11-01", "2026-11-03", "2026-11-05"]);
  // A day already submitted is not resubmitted; a cached pending target is.
  assert.deepEqual(datesToSubmit(cache, "2026-11-04"), ["2026-11-01", "2026-11-03"]);
  assert.deepEqual(datesToSubmit(cache, "2026-11-03"), ["2026-11-01", "2026-11-03"]);
});

void test("datesToSubmit fills days a failed run never cached, oldest first", () => {
  // 2026-11-19's run failed before fetching a value; 2026-11-18 was submitted.
  const cache: ObservationCache = {
    "2026-11-18": { value: "0", timestamp: "18", hash: "done" },
  };
  assert.deepEqual(datesToSubmit(cache, "2026-11-20"), ["2026-11-19", "2026-11-20"]);
  // Only days after the newest cached day are filled: a pending day comes
  // first, then the gap after it, then the new day.
  cache["2026-11-21"] = { value: "0", timestamp: "21" };
  assert.deepEqual(datesToSubmit(cache, "2026-11-23"), ["2026-11-21", "2026-11-22", "2026-11-23"]);
});

void test("missedDays crosses month ends, caps the backlog and needs a cached day", () => {
  const cache: ObservationCache = { "2026-11-29": { value: "0", timestamp: "1", hash: "x" } };
  assert.deepEqual(missedDays(cache, "2026-12-02"), ["2026-11-30", "2026-12-01"]);
  assert.deepEqual(missedDays(cache, "2026-12-20").length, 7);
  assert.deepEqual(missedDays(cache, "2026-12-20").at(-1), "2026-12-19");
  assert.deepEqual(missedDays({}, "2026-12-20"), []);
  assert.deepEqual(missedDays(cache, "2026-11-30"), []);
});
