import { getExercise } from '../data/exercises';
import { AGE_MODIFIERS, GOAL_WEIGHTS, THRESHOLDS, type Component } from '../evidence/rules';
import { e1rm, pctFor, repsToFailureAt, sessionE1rm, updateReferenceE1rm } from '../load/e1rm';
import { roundLoadKg, stepKg } from '../load/units';
import type {
  Goal, LoggedSet, Outcome, ProgressionState, Readiness, SlotPrescription, TrainingAge, UserProfile,
} from '../types';

export interface ClassifyResult {
  outcome: Outcome;
  completion: number;
  rirUsed: number | null;
  delta: number | null;
}

/**
 * Classify one exercise performance.
 * completion = Σ actual / Σ target reps (working sets).
 * RIR is shrunk toward the target by experience-based trust: rir_used = target + trust × (reported − target).
 */
export function classify(
  sets: LoggedSet[],
  targetRirMid: number,
  age: TrainingAge,
): ClassifyResult {
  const work = sets.filter((s) => s.type === 'working');
  const target = work.reduce((a, s) => a + s.targetReps, 0);
  const done = work.reduce((a, s) => a + Math.min(s.reps, s.targetReps), 0);
  const completion = target > 0 ? done / target : 0;
  const answered = work.filter((s) => s.rir != null);
  let rirUsed: number | null = null;
  let delta: number | null = null;
  if (answered.length) {
    const avg = answered.reduce((a, s) => a + (s.rir as number), 0) / answered.length;
    const trust = AGE_MODIFIERS[age].rirTrust;
    rirUsed = targetRirMid + trust * (avg - targetRirMid);
    delta = rirUsed - targetRirMid;
  }
  let outcome: Outcome;
  if (completion >= 1 - 1e-9) {
    if (delta == null) outcome = 'success';
    else if (delta >= THRESHOLDS.exceedRirDelta - 1e-9) outcome = 'exceed';
    else if (delta >= THRESHOLDS.grindRirDelta - 1e-9) outcome = 'success';
    else outcome = 'grind';
  } else if (completion >= THRESHOLDS.partialCompletion - 1e-9) outcome = 'partial';
  else outcome = 'fail';
  return { outcome, completion, rirUsed, delta };
}

/** Strength share of the main-lift prescription for a goal (decides FAIL handling). */
export function mainStrengthShare(goal: Goal): number {
  const w = GOAL_WEIGHTS[goal].main as Partial<Record<Component, number>>;
  const total = Object.values(w).reduce((a, b) => a + (b ?? 0), 0);
  return ((w.S ?? 0) + (w.P ?? 0)) / total;
}

export interface AdjustContext {
  profile: UserProfile;
  slot: SlotPrescription;
  state: ProgressionState;
  sets: LoggedSet[];
  readiness?: Readiness;
  referenceE1rmKg: number | null; // current smoothed reference before this session
  excludeFromLearning?: boolean; // safety event
}

export interface AdjustResult {
  state: ProgressionState;
  referenceE1rmKg: number | null;
  sessionE1rmKg: number | null;
  outcome: Outcome;
  ruleCode: string;
}

const isLower = (exerciseId: string) => {
  const p = getExercise(exerciseId).pattern;
  return p === 'squat' || p === 'hinge' || p === 'leg_press' || p === 'lunge' || p === 'hip_thrust';
};

/** Initial progression state from a fresh prescription. */
export function initialState(slot: SlotPrescription): ProgressionState {
  return {
    slotId: slot.id,
    exerciseId: slot.exerciseId,
    nextLoadKg: slot.loadKg,
    nextReps: Array.from({ length: slot.sets }, () => slot.targetReps),
    nextSets: slot.sets,
    restSec: slot.restSec,
    stallCount: 0,
    failCount: 0,
    partialStreak: 0,
    belowMinStreak: 0,
  };
}

/**
 * Main lift (load + RIR model).
 * exceed → e1RM-based, ≥ +1 step, ≤ +2 steps · success → +1 step (novice lower body +2)
 * grind/partial → hold (2nd consecutive partial → treated as fail) · fail → strength-leaning: hold load, reps −1;
 * otherwise load −2.5~5% with reps kept. A very-tired session softens the verdict by one level.
 */
export function adjustMainLift(ctx: AdjustContext): AdjustResult {
  const { profile, slot, sets } = ctx;
  const ex = getExercise(slot.exerciseId);
  const rirMid = (slot.rirMin + slot.rirMax) / 2;
  const bw = ex.bodyweightLoaded ? profile.bodyweightKg ?? 0 : 0;
  const work = sets.filter((s) => s.type === 'working');
  const sessE = sessionE1rm(work, rirMid, bw);
  const prevRef = ctx.referenceE1rmKg;
  const newRef = ctx.excludeFromLearning ? prevRef : updateReferenceE1rm(prevRef, sessE);
  const state: ProgressionState = { ...ctx.state, nextReps: [...ctx.state.nextReps] };
  const lastLoad = work.length ? Math.max(...work.map((s) => s.loadKg)) : (state.nextLoadKg ?? 0);
  const targetReps = state.nextReps[0] ?? slot.targetReps;

  if (ctx.excludeFromLearning || work.length === 0) {
    return { state: { ...state, painHold: ctx.excludeFromLearning || state.painHold }, referenceE1rmKg: prevRef, sessionE1rmKg: sessE, outcome: 'partial', ruleCode: 'MAIN_EXCLUDED' };
  }

  let { outcome } = classify(work, rirMid, profile.trainingAge);
  if (ctx.readiness === 1 && (outcome === 'fail' || outcome === 'partial')) outcome = outcome === 'fail' ? 'partial' : 'grind';
  if (outcome === 'partial' && state.partialStreak >= 1) outcome = 'fail';

  const step = stepKg(ex, profile.unit, profile.barbellIncrementKg);
  const round = (kg: number) => roundLoadKg(kg, ex, profile.unit, profile.barbellIncrementKg);
  const setAll = (reps: number) => (state.nextReps = Array.from({ length: state.nextSets }, () => reps));
  let rule = '';

  // Reps were reduced after an earlier fail: a successful session restores the original target first.
  const restoring = targetReps < slot.targetReps;

  if (state.painHold) {
    state.nextLoadKg = lastLoad;
    rule = 'MAIN_PAIN_HOLD';
    state.painHold = false;
  } else if ((outcome === 'exceed' || outcome === 'success') && restoring) {
    state.nextLoadKg = lastLoad;
    setAll(Math.min(slot.targetReps, targetReps + 1));
    rule = 'MAIN_RESTORE_REPS';
    state.stallCount = 0;
  } else if (outcome === 'exceed') {
    const ref = newRef ?? lastLoad / pctFor(targetReps, rirMid);
    const fromE1rm = round(ref * pctFor(targetReps, rirMid) - (bw || 0));
    const minNext = lastLoad + step;
    const maxNext = lastLoad + THRESHOLDS.maxIncreaseSteps * step;
    state.nextLoadKg = Math.min(maxNext, Math.max(minNext, fromE1rm));
    rule = 'MAIN_EXCEED_INCREASE';
    state.stallCount = 0;
  } else if (outcome === 'success') {
    const steps = profile.trainingAge === 'novice' && isLower(ex.id) ? AGE_MODIFIERS.novice.lowerIncrementSteps : 1;
    state.nextLoadKg = lastLoad + steps * step;
    rule = 'MAIN_SUCCESS_INCREASE';
    state.stallCount = 0;
  } else if (outcome === 'grind' || outcome === 'partial') {
    state.nextLoadKg = lastLoad;
    state.stallCount += 1;
    rule = outcome === 'grind' ? 'MAIN_GRIND_HOLD' : 'MAIN_PARTIAL_HOLD';
  } else {
    state.failCount += 1;
    state.stallCount += 1;
    if (mainStrengthShare(profile.goal) >= 0.5 && targetReps - 1 >= Math.max(3, slot.repMin - 1)) {
      state.nextLoadKg = lastLoad;
      setAll(targetReps - 1);
      rule = 'MAIN_FAIL_REDUCE_REPS';
    } else {
      // −2.5% to −5% depending on how far off the session was, at least one step down.
      const pct = THRESHOLDS.failReducePct.min;
      state.nextLoadKg = Math.min(lastLoad - step, round(lastLoad * (1 - pct)));
      rule = 'MAIN_FAIL_REDUCE_LOAD';
    }
  }
  state.partialStreak = outcome === 'partial' ? state.partialStreak + 1 : 0;
  state.lastOutcome = outcome;
  state.nextLoadKg = Math.max(0, state.nextLoadKg ?? 0);
  return { state, referenceE1rmKg: newRef, sessionE1rmKg: sessE, outcome, ruleCode: rule };
}

/**
 * Double progression for secondary/isolation.
 * all sets ≥ top of range (and not grinding beyond target) → +1 step, reset reps from e1RM prediction;
 * otherwise hold load and aim +1 rep per set; a set below range minimum in 2 consecutive sessions → −~7.5%.
 */
export function adjustDouble(ctx: AdjustContext): AdjustResult {
  const { profile, slot, sets } = ctx;
  const ex = getExercise(slot.exerciseId);
  const work = sets.filter((s) => s.type === 'working');
  const rirMid = (slot.rirMin + slot.rirMax) / 2;
  const bw = ex.bodyweightLoaded ? profile.bodyweightKg ?? 0 : 0;
  const sessE = sessionE1rm(work, rirMid, bw);
  const state: ProgressionState = { ...ctx.state, nextReps: [...ctx.state.nextReps] };
  if (ctx.excludeFromLearning || work.length === 0) {
    return { state: { ...state, painHold: true }, referenceE1rmKg: ctx.referenceE1rmKg, sessionE1rmKg: sessE, outcome: 'partial', ruleCode: 'DOUBLE_EXCLUDED' };
  }
  const newRef = updateReferenceE1rm(ctx.referenceE1rmKg, sessE);
  const load = Math.max(...work.map((s) => s.loadKg));
  const step = stepKg(ex, profile.unit, profile.barbellIncrementKg);
  const { outcome } = classify(work, rirMid, profile.trainingAge);
  const answered = work.filter((s) => s.rir != null);
  const avgRir = answered.length ? answered.reduce((a, s) => a + (s.rir as number), 0) / answered.length : null;
  const allTop = work.every((s) => s.reps >= slot.repMax);
  const anyBelow = work.some((s) => s.reps < slot.repMin);
  let rule: string;

  if (state.painHold) {
    state.nextLoadKg = load;
    state.painHold = false;
    rule = 'DOUBLE_PAIN_HOLD';
  } else if (allTop && (avgRir == null || avgRir >= slot.rirMin - 1)) {
    const next = load + step;
    state.nextLoadKg = next;
    // Predict reps at the new load from this session's e1RM; clamp into range (big DB jumps reset low).
    let reps = slot.repMin;
    if (sessE) reps = Math.floor(repsToFailureAt(next + bw, sessE) - rirMid);
    reps = Math.min(slot.repMax, Math.max(slot.repMin, reps));
    state.nextReps = Array.from({ length: state.nextSets }, () => reps);
    state.belowMinStreak = 0;
    state.stallCount = 0;
    rule = 'DOUBLE_TOP_INCREASE';
  } else if (anyBelow && state.belowMinStreak >= 1) {
    const reduced = roundLoadKg(load * (1 - THRESHOLDS.doubleBelowMinReducePct), ex, profile.unit, profile.barbellIncrementKg);
    state.nextLoadKg = Math.min(reduced, Math.max(0, load - step));
    state.nextReps = Array.from({ length: state.nextSets }, () => slot.repMin);
    state.belowMinStreak = 0;
    state.stallCount += 1;
    rule = 'DOUBLE_BELOW_MIN_REDUCE';
  } else {
    state.nextLoadKg = load;
    state.nextReps = Array.from({ length: state.nextSets }, (_, i) => {
      const prev = work[i]?.reps ?? work[work.length - 1].reps;
      return Math.min(slot.repMax, Math.max(slot.repMin, prev + 1));
    });
    state.belowMinStreak = anyBelow ? state.belowMinStreak + 1 : 0;
    state.stallCount += work.every((s, i) => s.reps <= (ctx.state.nextReps[i] ?? s.reps) - 1) ? 1 : 0;
    rule = anyBelow ? 'DOUBLE_BELOW_MIN_HOLD' : 'DOUBLE_HOLD_ADD_REPS';
  }
  state.lastOutcome = outcome;
  return { state, referenceE1rmKg: newRef, sessionE1rmKg: sessE, outcome, ruleCode: rule };
}

/**
 * Rest auto-adjust: a rep drop across sets at the same load that exceeds what the RIR target explains
 * → +30s next time (up to the role's ceiling). Two calm sessions with extended rest → −15s toward default.
 */
export function adjustRest(slot: SlotPrescription, state: ProgressionState, sets: LoggedSet[]): number {
  const work = sets.filter((s) => s.type === 'working');
  if (work.length < 2) return state.restSec;
  const sameLoad = work.every((s) => Math.abs(s.loadKg - work[0].loadKg) < 1e-6);
  if (!sameLoad) return state.restSec;
  const drop = work[0].reps - work[work.length - 1].reps;
  const expected = slot.rirMin >= 2 ? 1 : 2;
  const ceiling = slot.role === 'isolation' ? 150 : slot.role === 'secondary' ? 240 : 300;
  if (drop > expected + 1) return Math.min(ceiling, state.restSec + THRESHOLDS.restIncreaseSec);
  if (drop <= 0 && state.restSec > slot.restSec) return Math.max(slot.restSec, state.restSec - THRESHOLDS.restDecreaseSec);
  return state.restSec;
}

/** Entry point used by the app after an exercise is finished. */
export function adjustExercise(ctx: AdjustContext): AdjustResult {
  const r = ctx.slot.progression === 'load_rir' ? adjustMainLift(ctx) : adjustDouble(ctx);
  if (!ctx.excludeFromLearning) r.state.restSec = adjustRest(ctx.slot, ctx.state, ctx.sets);
  return r;
}

/** In-session calibration: suggested load for the next set from the first working set. */
export function suggestNextSetLoad(
  profile: UserProfile,
  slot: SlotPrescription,
  done: LoggedSet,
  targetReps: number,
): number | null {
  if (done.reps <= 0) return null;
  const ex = getExercise(slot.exerciseId);
  const bw = ex.bodyweightLoaded ? profile.bodyweightKg ?? 0 : 0;
  const rirMid = (slot.rirMin + slot.rirMax) / 2;
  const est = e1rm(done.loadKg + bw, done.reps, done.rir ?? Math.min(rirMid, 2));
  const raw = est * pctFor(targetReps, rirMid) - bw;
  const step = stepKg(ex, profile.unit, profile.barbellIncrementKg);
  const rounded = roundLoadKg(Math.max(0, raw), ex, profile.unit, profile.barbellIncrementKg);
  // limit in-session change to ±2 steps and ±5% for main lifts
  const maxDelta = slot.role === 'main' ? Math.min(2 * step, Math.max(step, done.loadKg * 0.05)) : 2 * step;
  return Math.max(0, Math.min(done.loadKg + maxDelta, Math.max(done.loadKg - maxDelta, rounded)));
}
