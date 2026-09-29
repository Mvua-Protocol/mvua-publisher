/**
 * Normalization and cross-source corroboration (P2.1.1, DR-0030).
 *
 * Turns raw millimetre readings into the single scaled integer that will be
 * signed and submitted. Two independent sources must agree within a tolerance
 * or the day is rejected: a corroborated value is the whole point of running a
 * publisher, and the contract's own median gate needs honest inputs to be
 * meaningful. Fail closed: on disagreement we throw and submit nothing.
 */
import type { DailyRainfall } from "./sources/types.js";

export class NormalizationError extends Error {}

export interface NormalizeOptions {
  /** Integer scale factor (e.g. 100 => hundredths of a millimetre). */
  readonly valueScale: number;
  /** Max tolerated |primary - cross| in scaled units before rejecting. */
  readonly maxSourceDelta: bigint;
}

/** Scale a millimetre reading to a non-negative integer in scaled units. */
export function scaleMillimetres(millimetres: number, valueScale: number): bigint {
  if (!Number.isFinite(millimetres) || millimetres < 0) {
    throw new NormalizationError(`invalid rainfall reading: ${millimetres}`);
  }
  // Round to the nearest scaled unit; rainfall is never negative.
  return BigInt(Math.round(millimetres * valueScale));
}

/**
 * Corroborate two source readings for the same day and return the agreed value.
 * The primary reading is authoritative once corroboration passes.
 */
export function normalizeRainfall(
  primary: DailyRainfall,
  cross: DailyRainfall,
  opts: NormalizeOptions,
): bigint {
  if (primary.date !== cross.date) {
    throw new NormalizationError(
      `source dates disagree: ${primary.date} vs ${cross.date}`,
    );
  }
  const primaryScaled = scaleMillimetres(primary.millimetres, opts.valueScale);
  const crossScaled = scaleMillimetres(cross.millimetres, opts.valueScale);
  const delta = primaryScaled > crossScaled ? primaryScaled - crossScaled : crossScaled - primaryScaled;
  if (delta > opts.maxSourceDelta) {
    throw new NormalizationError(
      `sources disagree by ${delta} scaled units (> ${opts.maxSourceDelta}) for ${primary.date}`,
    );
  }
  return primaryScaled;
}
