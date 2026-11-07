import type { LoggedSet, SlotPrescription, UserProfile } from '../types';

export const profile = (over: Partial<UserProfile> = {}): UserProfile => ({
  goal: 'strength_hypertrophy',
  daysPerWeek: 5,
  sessionMinutes: 60,
  trainingAge: 'intermediate',
  unit: 'kg',
  barbellIncrementKg: 2.5,
  rirPrompt: 'every_set',
  ...over,
});

export const sets = (loadKg: number, reps: number[], rir: (number | null)[] | number | null, target = reps[0]): LoggedSet[] =>
  reps.map((r, i) => ({
    setIdx: i,
    type: 'working',
    targetLoadKg: loadKg,
    targetReps: target,
    loadKg,
    reps: r,
    rir: Array.isArray(rir) ? rir[i] : rir,
  }));

export const slot = (over: Partial<SlotPrescription> = {}): SlotPrescription => ({
  id: 's1',
  exerciseId: 'bench_press',
  role: 'main',
  order: 0,
  sets: 4,
  minSets: 3,
  repMin: 4,
  repMax: 7,
  targetReps: 5,
  rirMin: 1,
  rirMax: 3,
  restSec: 180,
  loadKg: 80,
  loadSource: 'tested',
  pct1rm: 0.81,
  progression: 'load_rir',
  warmup: true,
  ...over,
});
