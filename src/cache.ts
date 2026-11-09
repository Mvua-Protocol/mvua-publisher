/**
 * Local observation cache and replay (P2.2.2).
 *
 * One JSON file per region and metric under `cache/` (git ignored) records each
 * day's corroborated, scaled value as soon as it is computed, and the
 * submission outcome once the oracle has it. So a run that crashes, or whose
 * RPC is down, resubmits the exact same value on the next run instead of
 * refetching (a source may have revised it), and days that were fetched but not
 * yet submitted are replayed oldest first.
 *
 * The oracle keeps only each publisher's latest observation and requires
 * timestamps to increase (DR-0035), so a replayed backlog lands in order and
 * only its newest day stays current; a day older than one already submitted is
 * rejected as a replay and marked done.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/** A cached day. `hash` absent: pending. A string or null: submitted (null = the oracle already had it). */
export interface CachedDay {
  readonly value: string;
  readonly timestamp: string;
  readonly hash?: string | null;
}

export type ObservationCache = Record<string, CachedDay>;

/** Read the cache, or an empty one if the file does not exist yet. */
export function loadCache(path: string): ObservationCache {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as ObservationCache;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw err;
  }
}

/** Write the cache atomically (temp file, then rename), so a crash never leaves it half written. */
export function saveCache(path: string, cache: ObservationCache): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(cache, null, 2)}\n`);
  renameSync(tmp, path);
}

/** The days this run should submit, oldest first: earlier pending days, then `date` unless already submitted. */
export function datesToSubmit(cache: ObservationCache, date: string): string[] {
  const pending = Object.keys(cache).filter((d) => d < date && cache[d]?.hash === undefined);
  const target = cache[date]?.hash === undefined ? [date] : [];
  return [...pending.sort(), ...target];
}
