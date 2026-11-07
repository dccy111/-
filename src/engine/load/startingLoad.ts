import { getExercise } from '../data/exercises';
import type { LoadReference } from '../types';

/**
 * Resolve the best reference 1RM for an exercise:
 * 1) tested/estimated value the user has, 2) ratio from a related lift (low evidence), 3) none → calibration.
 */
export function resolveReference(
  exerciseId: string,
  refs: Record<string, LoadReference | undefined>,
): LoadReference | null {
  const own = refs[exerciseId];
  if (own && own.oneRmKg > 0) return own;
  const ex = getExercise(exerciseId);
  if (ex.ratioFrom) {
    const base = refs[ex.ratioFrom.exerciseId];
    if (base && base.oneRmKg > 0) {
      return { exerciseId, oneRmKg: base.oneRmKg * ex.ratioFrom.ratio, source: 'derived_ratio' };
    }
  }
  return null;
}
