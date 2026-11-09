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
import { datesToSubmit, loadCache, saveCache, type ObservationCache } from "../src/cache.js";

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
