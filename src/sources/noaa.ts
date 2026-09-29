/**
 * NOAA GHCN-Daily source (cross-check), DR-0030.
 *
 * Uses NOAA's Climate Data Online (CDO) v2 API for the PRCP datatype at a fixed
 * GHCN-Daily station. Requires a free API token. In `units=metric`, PRCP is
 * returned in millimetres. NOAA archives lag by several days, so this is a
 * corroborating cross-check for finalized days, not the low-latency primary.
 * Docs: https://www.ncdc.noaa.gov/cdo-web/webservices/v2
 */
import { assertIsoDate, SourceError, type DailyRainfall, type RainfallSource } from "./types.js";

const CDO_URL = "https://www.ncei.noaa.gov/cdo-web/api/v2/data";

interface CdoResponse {
  results?: Array<{ date?: unknown; datatype?: unknown; value?: unknown }>;
}

export interface NoaaOptions {
  readonly stationId: string;
  readonly token: string;
}

export function createNoaaSource(opts: NoaaOptions): RainfallSource {
  return {
    name: "noaa-ghcnd",
    async fetchDay(date: string): Promise<DailyRainfall> {
      assertIsoDate(date);
      const url = new URL(CDO_URL);
      url.searchParams.set("datasetid", "GHCND");
      url.searchParams.set("stationid", opts.stationId);
      url.searchParams.set("datatypeid", "PRCP");
      url.searchParams.set("startdate", date);
      url.searchParams.set("enddate", date);
      url.searchParams.set("units", "metric");
      url.searchParams.set("limit", "10");

      const res = await fetch(url, {
        headers: { token: opts.token },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) {
        throw new SourceError("noaa-ghcnd", `HTTP ${res.status} ${res.statusText}`);
      }
      const body = (await res.json()) as CdoResponse;
      const row = body.results?.find((r) => r.datatype === "PRCP");
      if (!row || typeof row.value !== "number" || !Number.isFinite(row.value)) {
        throw new SourceError("noaa-ghcnd", `no PRCP value for ${date} (archive may lag)`);
      }
      // CDO metric PRCP is already in millimetres.
      return { date, millimetres: row.value };
    },
  };
}
