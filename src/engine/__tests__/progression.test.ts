import { describe, expect, it } from 'vitest';
import { adjustDouble, adjustExercise, adjustMainLift, adjustRest, classify, initialState, suggestNextSetLoad } from '../adjust/progression';
import type { ProgressionState } from '../types';
import { profile, sets, slot } from './helpers';

const mainCtx = (load: number, reps: number[], rir: number | number[] | null, over: Partial<Parameters<typeof adjustMainLift>[0]> = {}) => {
  const sl = slot({ loadKg: load });
  return { profile: profile(), slot: sl, state: initialState(sl), sets: sets(load, reps, rir, 5), referenceE1rmKg: 100, ...over };
};

describe('classify', () => {
  it('all reps + RIR on target → success', () => expect(classify(sets(80, [5, 5, 5, 5], 2), 2, 'intermediate').outcome).toBe('success'));
  it('missing one rep of 20 → partial', () => expect(classify(sets(80, [5, 5, 5, 4], 1, 5), 2, 'intermediate').outcome).toBe('partial'));
  it('5/5/4/3 → fail (85%)', () => expect(classify(sets(100, [5, 5, 4, 3], [1, 1, 0, 0], 5), 2, 'intermediate').outcome).toBe('fail'));
  it('all reps but RIR 0 → grind', () => expect(classify(sets(80, [5, 5, 5, 5], 0), 2, 'intermediate').outcome).toBe('grind'));
  it('novice RIR reports are shrunk toward the target', () => {
    expect(classify(sets(80, [5, 5], 3), 2, 'advanced').outcome).toBe('exceed');
    expect(classify(sets(80, [5, 5], 3), 2, 'novice').outcome).toBe('success');
  });
});

describe('main lift progression (spec examples)', () => {
  it('Bench 80kg 4×5, 5/5/5/5 @RIR2 → 82.5kg', () => {
    const r = adjustMainLift(mainCtx(80, [5, 5, 5, 5], 2));
    expect(r.outcome).toBe('success');
    expect(r.state.nextLoadKg).toBe(82.5);
  });
  it('Squat 100kg 5×4 @RIR3 (target 2) → 102.5kg, never more than +2 steps', () => {
    const sl = slot({ exerciseId: 'back_squat', loadKg: 100 });
    for (const age of ['intermediate', 'advanced'] as const) {
      const r = adjustMainLift({ profile: profile({ trainingAge: age }), slot: sl, state: initialState(sl), sets: sets(100, [5, 5, 5, 5], 3, 5), referenceE1rmKg: 123 });
      expect(r.state.nextLoadKg).toBe(102.5);
    }
    const big = adjustMainLift({ profile: profile({ trainingAge: 'advanced' }), slot: sl, state: initialState(sl), sets: sets(100, [5, 5, 5, 5], 3, 5), referenceE1rmKg: 160 });
    expect(big.state.nextLoadKg).toBeLessThanOrEqual(105);
  });
  it('100kg 5/5/4/3 @RIR0–1 → strength-leaning: 100kg × 4', () => {
    const r = adjustMainLift(mainCtx(100, [5, 5, 4, 3], [1, 1, 0, 0]));
    expect(r.outcome).toBe('fail');
    expect(r.state.nextLoadKg).toBe(100);
    expect(r.state.nextReps).toEqual([4, 4, 4, 4]);
  });
  it('100kg 5/5/4/3 @RIR0–1 → hypertrophy: 97.5kg × 5', () => {
    const r = adjustMainLift(mainCtx(100, [5, 5, 4, 3], [1, 1, 0, 0], { profile: profile({ goal: 'hypertrophy' }) }));
    expect(r.state.nextLoadKg).toBe(97.5);
    expect(r.state.nextReps).toEqual([5, 5, 5, 5]);
  });
  it('partial once → hold, twice in a row → treated as fail', () => {
    const first = adjustMainLift(mainCtx(100, [5, 5, 5, 4], 1));
    expect(first.state.nextLoadKg).toBe(100);
    const second = adjustMainLift({ ...mainCtx(100, [5, 5, 5, 4], 1), state: first.state });
    expect(second.outcome).toBe('fail');
  });
  it('a very tired day softens a fail to a hold', () => {
    const r = adjustMainLift(mainCtx(100, [5, 5, 4, 3], 0, { readiness: 1 }));
    expect(r.state.nextLoadKg).toBe(100);
    expect(r.state.nextReps).toEqual([5, 5, 5, 5]);
  });
  it('after reducing reps, success restores reps before adding load', () => {
    const failed = adjustMainLift(mainCtx(100, [5, 5, 4, 3], 0));
    const r = adjustMainLift({ ...mainCtx(100, [4, 4, 4, 4], 2), sets: sets(100, [4, 4, 4, 4], 2, 4), state: failed.state });
    expect(r.state.nextLoadKg).toBe(100);
    expect(r.state.nextReps[0]).toBe(5);
  });
  it('novice lower body success → +2 steps', () => {
    const sl = slot({ exerciseId: 'back_squat', loadKg: 60 });
    const r = adjustMainLift({ profile: profile({ trainingAge: 'novice' }), slot: sl, state: initialState(sl), sets: sets(60, [5, 5, 5, 5], 3, 5), referenceE1rmKg: 75 });
    expect(r.state.nextLoadKg).toBe(65);
  });
  it('pain flag holds the load once; safety-excluded sessions do not learn', () => {
    const held = adjustMainLift({ ...mainCtx(80, [5, 5, 5, 5], 2), state: { ...initialState(slot()), painHold: true } });
    expect(held.state.nextLoadKg).toBe(80);
    const ex = adjustMainLift(mainCtx(80, [5, 5, 5, 5], 3, { excludeFromLearning: true }));
    expect(ex.referenceE1rmKg).toBe(100);
  });
  it('lb users progress by 5lb', () => {
    const r = adjustMainLift({ ...mainCtx(lbsToKg(185), [5, 5, 5, 5], 2), profile: profile({ unit: 'lb' }) });
    expect(r.state.nextLoadKg! / 0.45359237).toBeCloseTo(190, 6);
  });
});

function lbsToKg(lb: number) {
  return lb * 0.45359237;
}

describe('double progression (spec examples)', () => {
  const iso = slot({ id: 'i', exerciseId: 'seated_cable_row', role: 'secondary', repMin: 8, repMax: 12, targetReps: 8, sets: 3, progression: 'double', loadKg: 50, rirMin: 1, rirMax: 3 });
  const ctx = (reps: number[], rir: number | null, state?: ProgressionState) => ({
    profile: profile(), slot: iso, state: state ?? initialState(iso), sets: sets(50, reps, rir, 8), referenceE1rmKg: null,
  });
  it('12/12/12 → 52.5kg', () => {
    const r = adjustDouble(ctx([12, 12, 12], 2));
    expect(r.state.nextLoadKg).toBe(52.5);
    expect(r.state.nextReps.every((x) => x >= 8 && x <= 12)).toBe(true);
  });
  it('10/9/8 → hold, +1 rep per set', () => {
    const r = adjustDouble(ctx([10, 9, 8], 1));
    expect(r.state.nextLoadKg).toBe(50);
    expect(r.state.nextReps).toEqual([11, 10, 9]);
  });
  it('below range twice in a row → reduce', () => {
    const a = adjustDouble(ctx([8, 7, 6], 0));
    expect(a.state.nextLoadKg).toBe(50);
    const b = adjustDouble(ctx([8, 7, 6], 0, a.state));
    expect(b.state.nextLoadKg).toBeLessThan(50);
  });
  it('big dumbbell jump resets target reps low in the range', () => {
    const dbSlot = { ...iso, exerciseId: 'lateral_raise', role: 'isolation' as const, repMin: 10, repMax: 15, loadKg: 8 };
    const r = adjustDouble({ profile: profile(), slot: dbSlot, state: initialState(dbSlot), sets: sets(8, [15, 15, 15], 1, 10), referenceE1rmKg: null });
    expect(r.state.nextLoadKg).toBe(10);
    expect(r.state.nextReps[0]).toBeLessThan(15);
    expect(r.state.nextReps[0]).toBeGreaterThanOrEqual(10);
  });
});

describe('rest auto-adjust', () => {
  const sl = slot({ restSec: 180, rirMin: 2, rirMax: 3 });
  it('large rep drop at the same load → +30s', () => {
    expect(adjustRest(sl, initialState(sl), sets(80, [8, 7, 5, 4], 1, 8))).toBe(210);
  });
  it('respects ceiling', () => {
    expect(adjustRest(sl, { ...initialState(sl), restSec: 300 }, sets(80, [8, 4], 0, 8))).toBe(300);
  });
  it('calm session with extended rest → −15s toward default', () => {
    expect(adjustRest(sl, { ...initialState(sl), restSec: 210 }, sets(80, [5, 5, 5], 2))).toBe(195);
  });
  it('adjustExercise wires rest + progression', () => {
    const r = adjustExercise({ profile: profile(), slot: sl, state: initialState(sl), sets: sets(80, [5, 5, 5, 5], 2), referenceE1rmKg: 100 });
    expect(r.state.restSec).toBe(180);
  });
});

describe('in-session calibration', () => {
  it('suggests a load for the next set from the first set, limited to ±2 steps', () => {
    const iso = slot({ exerciseId: 'incline_db_press', role: 'secondary', progression: 'double', loadKg: null, targetReps: 8, repMin: 8, repMax: 12 });
    const next = suggestNextSetLoad(profile(), iso, { setIdx: 0, type: 'working', targetLoadKg: null, targetReps: 8, loadKg: 20, reps: 12, rir: 3 }, 8);
    // 20kg × 12 @RIR3 → e1RM 30 → 8 reps @RIR2 ≈ 75% → 22.5 → dumbbell grid (tie down) 22
    expect(next).toBe(22);
  });
});
