/**
 * Retry with exponential backoff (P2.2.1).
 *
 * Wraps the network steps of a run (source fetches, the oracle submission) so a
 * transient failure (a timeout, an HTTP 5xx, an RPC hiccup) does not cost the
 * day. Failures that cannot heal are retried too, which only delays the final
 * error; a duplicate submission is impossible because the oracle rejects a
 * replayed observation (see `submit.ts`).
 */
import type { Logger } from "./logger.js";

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Run `fn`; on failure wait `baseMs`, then double it, up to `attempts` tries in total. */
export async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  log: Logger,
  attempts = 4,
  baseMs = 2000,
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= attempts) throw err;
      const delayMs = baseMs * 2 ** (attempt - 1);
      const error = err instanceof Error ? err.message : String(err);
      log.warn("retrying", { label, attempt, delayMs, error });
      await sleep(delayMs);
    }
  }
}
