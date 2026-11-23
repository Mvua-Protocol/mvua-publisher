/**
 * Uptime status (P2.2.3): reads the observation cache and reports how many of
 * the last N days this publisher submitted, which days it missed, and its
 * uptime against the 99.5 percent target.
 *
 * The publisher is a one-shot run, not a server, so health is reported from
 * the cache rather than an HTTP endpoint. A day counts as submitted once the
 * oracle has it (a hash, or null when the oracle already had it). Days before
 * the cache's first entry are not counted, so a new publisher is not charged
 * for days it never ran.
 *
 * Usage: `npm run status [days]` (default 30). Prints one JSON line per cache
 * file. Reads no secrets.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { loadCache, type ObservationCache } from "./cache.js";

export const UPTIME_TARGET_PCT = 99.5;

export interface UptimeReport {
  readonly from: string;
  readonly to: string;
  readonly days: number;
  readonly submitted: number;
  readonly missed: readonly string[];
  readonly uptimePct: number;
  readonly meetsTarget: boolean;
  readonly lastSubmitted: string | null;
}

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Uptime over the `days` days ending at `to` (inclusive), from the cache. */
export function uptimeReport(cache: ObservationCache, to: string, days = 30): UptimeReport {
  const keys = Object.keys(cache).sort();
  const first = keys[0];
  let from = addDays(to, 1 - days);
  if (first !== undefined && first > from) from = first;

  const missed: string[] = [];
  let counted = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    counted += 1;
    if (cache[d]?.hash === undefined) missed.push(d);
  }
  const submitted = counted - missed.length;
  const uptimePct = counted === 0 ? 0 : Math.round((submitted / counted) * 10000) / 100;
  const done = keys.filter((d) => cache[d]?.hash !== undefined);
  return {
    from,
    to,
    days: counted,
    submitted,
    missed,
    uptimePct,
    meetsTarget: counted > 0 && uptimePct >= UPTIME_TARGET_PCT,
    lastSubmitted: done.at(-1) ?? null,
  };
}

/** The previous complete UTC day as YYYY-MM-DD. */
function yesterdayUtc(): string {
  return addDays(new Date().toISOString().slice(0, 10), -1);
}

function main(): void {
  const days = Number(process.argv[2] ?? 30);
  if (!Number.isInteger(days) || days < 1) throw new Error("days must be a positive integer");
  let files: string[] = [];
  try {
    files = readdirSync("cache").filter((f) => f.endsWith(".json"));
  } catch {
    // No cache yet: nothing has run.
  }
  if (files.length === 0) {
    console.log(JSON.stringify({ msg: "no cache files", dir: "cache" }));
    return;
  }
  for (const file of files.sort()) {
    const report = uptimeReport(loadCache(join("cache", file)), yesterdayUtc(), days);
    console.log(JSON.stringify({ series: file.replace(/\.json$/, ""), ...report }));
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
