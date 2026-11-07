import { getExercise } from '../data/exercises';
import { VOLUME_PRIORITY } from '../data/muscles';
import { GOAL_VOLUME_MULTIPLIER, VOLUME_BASE } from '../evidence/rules';
import type { Goal, LoggedSet, MuscleId, ProgramDay, SlotPrescription, TrainingAge } from '../types';

export type VolumeMap = Partial<Record<MuscleId, number>>;

/** Weighted sets per muscle: primary 1.0 / secondary 0.5 (internal; UI shows rounded sets). */
export function addSetsToVolume(map: VolumeMap, exerciseId: string, sets: number) {
  for (const m of getExercise(exerciseId).muscles) map[m.muscle] = (map[m.muscle] ?? 0) + sets * m.contribution;
}

export function slotVolume(slots: SlotPrescription[]): VolumeMap {
  const v: VolumeMap = {};
  for (const s of slots) addSetsToVolume(v, s.exerciseId, s.sets);
  return v;
}

export function weeklyPlannedVolume(days: ProgramDay[]): VolumeMap {
  const v: VolumeMap = {};
  for (const d of days) for (const s of d.slots) addSetsToVolume(v, s.exerciseId, s.sets);
  return v;
}

/** Hard set = working set with RIR ≤ 4 (or unknown). Warm-ups excluded. */
export function isHardSet(s: Pick<LoggedSet, 'type' | 'rir' | 'reps'>): boolean {
  return s.type === 'working' && s.reps > 0 && (s.rir == null || s.rir <= 4);
}

export function performedVolume(entries: { exerciseId: string; sets: LoggedSet[] }[]): VolumeMap {
  const v: VolumeMap = {};
  for (const e of entries) addSetsToVolume(v, e.exerciseId, e.sets.filter(isHardSet).length);
  return v;
}

/** Weekly starting-point range per targeted muscle. */
export function volumeTargets(goal: Goal, age: TrainingAge): Partial<Record<MuscleId, [number, number]>> {
  const [lo, hi] = VOLUME_BASE[age];
  const g = GOAL_VOLUME_MULTIPLIER[goal];
  const out: Partial<Record<MuscleId, [number, number]>> = {};
  for (const [m, p] of Object.entries(VOLUME_PRIORITY) as [MuscleId, number][]) {
    out[m] = [Math.round(lo * g * p), Math.round(hi * g * p)];
  }
  return out;
}

export function round1(v: number) {
  return Math.round(v * 10) / 10;
}
