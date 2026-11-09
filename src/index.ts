/**
 * Publisher entrypoint (P2.1.1): one-shot run that reports a single day.
 *
 * Fetch a UTC day of rainfall from the primary and cross-check sources,
 * corroborate and scale it, sign the payload, and submit it to the oracle. Any
 * failure (unreachable source, disagreement, bad config) aborts before
 * submission: a missing observation is safe, a wrong one is not.
 *
 * Scheduling (P2.2.1): the run stays one-shot and the OS scheduler starts it
 * once a day (cron, a systemd timer, or Windows Task Scheduler; see README).
 * Source fetches and the submission are retried with backoff; a rerun or retry
 * can never double count, because the oracle rejects a replayed observation.
 * The local cache and gap-filling replay are P2.2.2.
 *
 * Usage: `npm run dev [YYYY-MM-DD]` (defaults to yesterday UTC).
 */
import { loadConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { normalizeRainfall } from "./normalize.js";
import { withRetry } from "./retry.js";
import { encodeObservationPayloadXdr, type ObservationInput } from "./schema/observation.js";
import { keypairFromSeedHex, signPayload } from "./signing/signer.js";
import { createNoaaSource } from "./sources/noaa.js";
import { createOpenMeteoSource } from "./sources/open-meteo.js";
import { submitObservation } from "./submit.js";

/** The previous complete UTC day as YYYY-MM-DD. */
function yesterdayUtc(now: Date = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Representative unix-seconds timestamp for a UTC date (midday). */
function timestampForDate(date: string): bigint {
  return BigInt(Math.floor(Date.parse(`${date}T12:00:00Z`) / 1000));
}

async function main(): Promise<void> {
  const config = loadConfig();
  const log = createLogger(config.logLevel);
  const date = process.argv[2] ?? yesterdayUtc();

  const publisher = keypairFromSeedHex(config.publisherSeedHex);
  log.info("run start", {
    date,
    region: config.region,
    metric: config.metric,
    publisher: publisher.publicKey.toString("hex"),
  });

  const primary = createOpenMeteoSource({
    latitude: config.latitude,
    longitude: config.longitude,
  });
  const cross = createNoaaSource({ stationId: config.noaaStationId, token: config.noaaToken });

  const [primaryDay, crossDay] = await Promise.all([
    withRetry("open-meteo", () => primary.fetchDay(date), log),
    withRetry("noaa", () => cross.fetchDay(date), log),
  ]);
  log.debug("source readings", {
    primary: primaryDay.millimetres,
    cross: crossDay.millimetres,
  });

  const value = normalizeRainfall(primaryDay, crossDay, {
    valueScale: config.valueScale,
    maxSourceDelta: config.maxSourceDelta,
  });

  const observation: ObservationInput = {
    region: config.region,
    metric: config.metric,
    timestamp: timestampForDate(date),
    value,
  };

  const message = encodeObservationPayloadXdr(observation);
  const signature = signPayload(message, publisher.secretKey);

  const result = await withRetry(
    "submit",
    () =>
      submitObservation(
        {
          rpcUrl: config.rpcUrl,
          networkPassphrase: config.networkPassphrase,
          allowHttp: config.network === "local",
          oracleContractId: config.oracleContractId,
          submitterSecret: config.submitterSecret,
          region: observation.region,
          metric: observation.metric,
          timestamp: observation.timestamp,
          value: observation.value,
          publisher: publisher.publicKey,
          signature,
        },
        log,
      ),
    log,
  );

  if (result.hash === null) {
    log.info("already submitted", { date, value: value.toString() });
  } else {
    log.info("submitted", { date, value: value.toString(), hash: result.hash });
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  // Structured error to stderr; never include key material.
  console.error(JSON.stringify({ ts: new Date().toISOString(), level: "error", msg: message }));
  process.exitCode = 1;
});
