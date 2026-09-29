/** Shared shapes for weather data sources (P2.1.1, DR-0030). */

/** One day of rainfall in millimetres, as reported by a source. */
export interface DailyRainfall {
  /** ISO date, YYYY-MM-DD, UTC. */
  readonly date: string;
  /** Rainfall total for the day, in millimetres. */
  readonly millimetres: number;
}

/** A source that can return a single day's rainfall for a fixed location. */
export interface RainfallSource {
  /** Human-readable source name for logs and errors. */
  readonly name: string;
  /** Fetch one UTC day. Throws (fail closed) if the day is unavailable. */
  fetchDay(date: string): Promise<DailyRainfall>;
}

/** Thrown when a source cannot return a usable value for the requested day. */
export class SourceError extends Error {
  constructor(
    readonly source: string,
    message: string,
  ) {
    super(`[${source}] ${message}`);
  }
}

/** A YYYY-MM-DD guard used by both sources. */
export function assertIsoDate(date: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`expected YYYY-MM-DD date, got ${JSON.stringify(date)}`);
  }
}
