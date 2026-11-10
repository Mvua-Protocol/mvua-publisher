/**
 * Open-Meteo sources, DR-0030 and DR-0039.
 *
 * Without a `model`, the historical archive API (the primary feed): daily
 * `precipitation_sum` in millimetres for a lat/lon, keyless and low latency.
 * With a `model` (for example `gfs_seamless`, NOAA's GFS), the forecast API's
 * record of that model for past days: an independent agency's model, available
 * for yesterday, used as the cross check now that NOAA station data is stale.
 * Both answer the same request and response shape.
 * Docs: https://open-meteo.com/en/docs/historical-weather-api
 */
import { assertIsoDate, SourceError, type DailyRainfall, type RainfallSource } from "./types.js";

const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

interface OpenMeteoResponse {
  daily?: {
    time?: unknown;
    precipitation_sum?: unknown;
  };
}

export interface OpenMeteoOptions {
  readonly latitude: number;
  readonly longitude: number;
  /** A specific weather model (forecast API); omit for the historical archive. */
  readonly model?: string;
}

export function createOpenMeteoSource(opts: OpenMeteoOptions): RainfallSource {
  const name = opts.model ? `open-meteo:${opts.model}` : "open-meteo";
  return {
    name,
    async fetchDay(date: string): Promise<DailyRainfall> {
      assertIsoDate(date);
      const url = new URL(opts.model ? FORECAST_URL : ARCHIVE_URL);
      if (opts.model) url.searchParams.set("models", opts.model);
      url.searchParams.set("latitude", opts.latitude.toString());
      url.searchParams.set("longitude", opts.longitude.toString());
      url.searchParams.set("start_date", date);
      url.searchParams.set("end_date", date);
      url.searchParams.set("daily", "precipitation_sum");
      url.searchParams.set("timezone", "UTC");

      const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) {
        throw new SourceError(name, `HTTP ${res.status} ${res.statusText}`);
      }
      const body = (await res.json()) as OpenMeteoResponse;
      const times = body.daily?.time;
      const sums = body.daily?.precipitation_sum;
      if (!Array.isArray(times) || !Array.isArray(sums) || times.length === 0) {
        throw new SourceError(name, "response missing daily precipitation_sum");
      }
      const idx = times.indexOf(date);
      if (idx < 0) {
        throw new SourceError(name, `no row for ${date}`);
      }
      const mm: unknown = sums[idx];
      if (typeof mm !== "number" || !Number.isFinite(mm)) {
        throw new SourceError(name, `null or non-numeric precipitation for ${date}`);
      }
      return { date, millimetres: mm };
    },
  };
}
