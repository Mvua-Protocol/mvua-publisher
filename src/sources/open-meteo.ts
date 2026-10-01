/**
 * Open-Meteo historical archive source (primary), DR-0030.
 *
 * The archive API returns daily `precipitation_sum` in millimetres for a
 * lat/lon. It is keyless and low-latency, which is why it is the primary feed.
 * Docs: https://open-meteo.com/en/docs/historical-weather-api
 */
import { assertIsoDate, SourceError, type DailyRainfall, type RainfallSource } from "./types.js";

const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";

interface OpenMeteoResponse {
  daily?: {
    time?: unknown;
    precipitation_sum?: unknown;
  };
}

export interface OpenMeteoOptions {
  readonly latitude: number;
  readonly longitude: number;
}

export function createOpenMeteoSource(opts: OpenMeteoOptions): RainfallSource {
  return {
    name: "open-meteo",
    async fetchDay(date: string): Promise<DailyRainfall> {
      assertIsoDate(date);
      const url = new URL(ARCHIVE_URL);
      url.searchParams.set("latitude", opts.latitude.toString());
      url.searchParams.set("longitude", opts.longitude.toString());
      url.searchParams.set("start_date", date);
      url.searchParams.set("end_date", date);
      url.searchParams.set("daily", "precipitation_sum");
      url.searchParams.set("timezone", "UTC");

      const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) {
        throw new SourceError("open-meteo", `HTTP ${res.status} ${res.statusText}`);
      }
      const body = (await res.json()) as OpenMeteoResponse;
      const times = body.daily?.time;
      const sums = body.daily?.precipitation_sum;
      if (!Array.isArray(times) || !Array.isArray(sums) || times.length === 0) {
        throw new SourceError("open-meteo", "response missing daily precipitation_sum");
      }
      const idx = times.indexOf(date);
      if (idx < 0) {
        throw new SourceError("open-meteo", `no row for ${date}`);
      }
      const mm: unknown = sums[idx];
      if (typeof mm !== "number" || !Number.isFinite(mm)) {
        throw new SourceError("open-meteo", `null or non-numeric precipitation for ${date}`);
      }
      return { date, millimetres: mm };
    },
  };
}
