import { getExercise } from '../data/exercises';
import { AGE_MODIFIERS, GOAL_WEIGHTS, ZONES, type Component, type Zone } from '../evidence/rules';
import { pctFor } from '../load/e1rm';
import { roundLoadKg } from '../load/units';
import type { Goal, LoadReference, Role, SlotPrescription, TrainingAge, UserProfile } from '../types';

export interface BlendedZone {
  repMin: number;
  repMax: number;
  targetReps: number;
  rirMin: number;
  rirMax: number;
  rirMid: number;
  sets: number;
  restSec: number;
}

const mid = (r: [number, number]) => (r[0] + r[1]) / 2;

/** Weighted blend of goal components for a role. Deterministic, no branching on goal names. */
export function blendZone(goal: Goal, role: Role, age: TrainingAge): BlendedZone {
  const weights = GOAL_WEIGHTS[goal][role];
  const entries = Object.entries(weights) as [Component, number][];
  const total = entries.reduce((a, [, w]) => a + w, 0);
  const acc = (f: (z: Zone) => number) => entries.reduce((a, [c, w]) => a + (w / total) * f(ZONES[c][role]), 0);

  const mod = AGE_MODIFIERS[age];
  const repMin = Math.round(acc((z) => z.reps[0]));
  const repMax = Math.max(repMin + 1, Math.round(acc((z) => z.reps[1])));
  const targetReps = Math.min(repMax, Math.max(repMin, Math.round(acc((z) => mid(z.reps)))));
  const minRir = role === 'isolation' ? mod.minIsolationRir : 0;
  const rirMin = Math.max(minRir, Math.round(acc((z) => z.rir[0])) + mod.rirShift);
  const rirMax = Math.max(rirMin, Math.round(acc((z) => z.rir[1])) + mod.rirShift);
  const rirMid = (rirMin + rirMax) / 2;
  const sets = Math.round(acc((z) => mid(z.sets)));
  const restSec = Math.round(acc((z) => z.restSec) / 15) * 15;
  return { repMin, repMax, targetReps, rirMin, rirMax, rirMid, sets, restSec };
}

/**
 * Rest by role × intensity (evidence: moderate for strength, low for hypertrophy):
 * ≥85% compound → 180–300s, 75–85% → 150–180s, <75% compound → 120–150s, isolation → 60–120s.
 */
export function restFor(role: Role, pct: number | null, compound: boolean, blendedRest: number): number {
  let lo: number, hi: number;
  if (!compound) [lo, hi] = [60, 120];
  else if (pct != null && pct >= 0.85) [lo, hi] = [180, 300];
  else if (pct != null && pct >= 0.75) [lo, hi] = [150, 210];
  else if (role === 'main') [lo, hi] = [150, 240];
  else [lo, hi] = [120, 180];
  return Math.min(hi, Math.max(lo, blendedRest));
}

export interface PrescribeInput {
  slotId: string;
  exerciseId: string;
  role: Role;
  order: number;
  profile: UserProfile;
  reference: LoadReference | null;
  /** DUP: second exposure of the same main lift in a week uses a volume-day rep shift. */
  repShift?: number;
}

export function prescribeSlot(input: PrescribeInput): SlotPrescription {
  const { profile, role } = input;
  const ex = getExercise(input.exerciseId);
  const z = blendZone(profile.goal, role, profile.trainingAge);

  // Clamp to what the exercise tolerates (e.g. lateral raises aren't done for 5).
  let repMin = Math.max(z.repMin, role === 'main' ? Math.min(z.repMin, ex.repMin) : ex.repMin);
  let repMax = Math.min(Math.max(z.repMax, repMin + 2), Math.max(ex.repMax, repMin + 2));
  if (role !== 'main') {
    repMin = Math.max(repMin, ex.repMin);
    repMax = Math.max(repMin + 2, Math.min(repMax, ex.repMax));
  }
  let targetReps = Math.min(repMax, Math.max(repMin, z.targetReps + (input.repShift ?? 0)));
  if (input.repShift) repMax = Math.max(repMax, targetReps);
  const progression = role === 'main' && ex.oneRmApplicable ? 'load_rir' : 'double';
  if (progression === 'double') targetReps = repMin;

  // Load: reps + RIR → %1RM (Epley inverse) so load and reps are always consistent.
  let loadKg: number | null = null;
  let pct: number | null = null;
  let loadSource: SlotPrescription['loadSource'] = 'calibration';
  if (input.reference && ex.oneRmApplicable) {
    pct = pctFor(targetReps, z.rirMid);
    let raw = input.reference.oneRmKg * pct;
    if (ex.bodyweightLoaded) raw = Math.max(0, raw - (profile.bodyweightKg ?? raw));
    loadKg = roundLoadKg(raw, ex, profile.unit, profile.barbellIncrementKg);
    loadSource = input.reference.source;
  } else if (ex.bodyweightLoaded) {
    loadKg = 0; // bodyweight only; progress reps, then add weight
    loadSource = 'estimated';
  }

  const sets = Math.max(2, z.sets);
  return {
    id: input.slotId,
    exerciseId: ex.id,
    role,
    order: input.order,
    sets,
    minSets: role === 'main' ? Math.min(3, sets) : 2,
    repMin,
    repMax,
    targetReps,
    rirMin: z.rirMin,
    rirMax: z.rirMax,
    restSec: restFor(role, pct, ex.mechanic === 'compound', z.restSec),
    loadKg,
    loadSource,
    pct1rm: pct,
    progression,
    warmup: role === 'main' || (ex.equipment === 'barbell' && ex.mechanic === 'compound'),
  };
}
