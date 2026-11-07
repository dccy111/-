import { THRESHOLDS } from '../evidence/rules';
import type { LoggedSet } from '../types';

export type E1rmFormula = 'epley' | 'brzycki';

/** Reps-to-failure = reps + RIR. */
export function e1rm(loadKg: number, reps: number, rir = 0, formula: E1rmFormula = 'epley'): number {
  const n = reps + rir;
  if (reps <= 0 || loadKg <= 0) return 0;
  if (n <= 1) return loadKg;
  if (formula === 'brzycki') return (loadKg * 36) / (37 - Math.min(n, 36));
  return loadKg * (1 + n / 30);
}

/** Inverse: fraction of 1RM that allows `reps` with `rir` in reserve. */
export function pctFor(reps: number, rir: number, formula: E1rmFormula = 'epley'): number {
  const n = reps + rir;
  if (n <= 1) return 1;
  if (formula === 'brzycki') return (37 - Math.min(n, 36)) / 36;
  return 1 / (1 + n / 30);
}

/** Predicted reps to failure at a load for a given 1RM (inverse Epley). */
export function repsToFailureAt(loadKg: number, oneRmKg: number): number {
  if (loadKg <= 0) return 30;
  return Math.max(0, 30 * (oneRmKg / loadKg - 1));
}

/**
 * RIR used for e1RM: never assume 0 when missing (would under-estimate) nor trust a missing value
 * as high (would over-estimate). Missing → min(targetRir, 2). "3+" is stored as 3 (conservative).
 */
export function rirForEstimate(set: Pick<LoggedSet, 'rir'>, targetRir: number): number {
  if (set.rir == null) return Math.min(targetRir, 2);
  return Math.min(set.rir, 3);
}

/**
 * Session e1RM = best working-set e1RM within the valid range (reps + RIR ≤ 12).
 * Returns null when no set qualifies.
 */
export function sessionE1rm(
  sets: LoggedSet[],
  targetRir: number,
  extraLoadKg = 0, // bodyweight for bodyweight-loaded movements
): number | null {
  let best: number | null = null;
  for (const s of sets) {
    if (s.type !== 'working' || s.reps <= 0) continue;
    const rir = rirForEstimate(s, targetRir);
    if (s.reps + rir > THRESHOLDS.e1rmMaxRepsPlusRir) continue;
    const v = e1rm(s.loadKg + extraLoadKg, s.reps, rir);
    if (best === null || v > best) best = v;
  }
  return best;
}

/** Smoothed reference update: rises faster than it falls; capped per session. */
export function updateReferenceE1rm(prev: number | null, session: number | null): number | null {
  if (session == null) return prev;
  if (prev == null || prev <= 0) return session;
  const up = session >= prev;
  const alpha = up ? THRESHOLDS.e1rmAlphaUp : THRESHOLDS.e1rmAlphaDown;
  let next = prev + alpha * (session - prev);
  next = Math.min(next, prev * (1 + THRESHOLDS.e1rmMaxUpPct));
  next = Math.max(next, prev * (1 - THRESHOLDS.e1rmMaxDownPct));
  return next;
}
