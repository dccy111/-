import { describe, expect, it } from 'vitest';
import { getExercise } from '../data/exercises';
import { e1rm, pctFor, rirForEstimate, sessionE1rm, updateReferenceE1rm } from '../load/e1rm';
import { formatLoad, kgToLb, lbToKg, roundLoadKg, roundToIncrement } from '../load/units';
import { sets } from './helpers';

describe('e1RM', () => {
  it('Epley: 100kg × 5 → 116.7', () => expect(e1rm(100, 5)).toBeCloseTo(116.67, 2));
  it('Brzycki: 100kg × 5 → 112.5', () => expect(e1rm(100, 5, 0, 'brzycki')).toBeCloseTo(112.5, 2));
  it('single at RIR 0 equals the load', () => expect(e1rm(140, 1, 0)).toBe(140));
  it('RIR adds to reps-to-failure', () => expect(e1rm(100, 5, 2)).toBeCloseTo(e1rm(100, 7), 6));
  it('140 × 5 → 163 (onboarding example)', () => expect(Math.round(e1rm(140, 5))).toBe(163));
  it('inverse is consistent: load(pct) → e1rm returns the 1RM', () => {
    for (const [reps, rir] of [[3, 1], [5, 2], [8, 2], [10, 0]]) {
      const load = 120 * pctFor(reps, rir);
      expect(e1rm(load, reps, rir)).toBeCloseTo(120, 6);
    }
  });
  it('%1RM table matches the design (5 reps + RIR 2 ≈ 81%)', () => {
    expect(pctFor(5, 2)).toBeCloseTo(0.811, 3);
    expect(pctFor(8, 2)).toBeCloseTo(0.75, 3);
  });
  it('missing RIR is treated conservatively, 3+ counts as 3', () => {
    expect(rirForEstimate({ rir: null }, 3)).toBe(2);
    expect(rirForEstimate({ rir: null }, 1)).toBe(1);
    expect(rirForEstimate({ rir: 3 }, 2)).toBe(3);
  });
  it('sets with reps + RIR > 12 do not update e1RM', () => {
    expect(sessionE1rm(sets(50, [12, 12], 2), 2)).toBeNull();
    expect(sessionE1rm(sets(80, [5, 5], 2), 2)).toBeCloseTo(e1rm(80, 5, 2), 6);
  });
  it('session e1RM uses the best set and ignores warm-ups', () => {
    const s = [...sets(80, [5, 4], [2, 1])];
    s.unshift({ setIdx: -1, type: 'warmup', targetLoadKg: 60, targetReps: 3, loadKg: 200, reps: 3, rir: 5 });
    expect(sessionE1rm(s, 2)).toBeCloseTo(e1rm(80, 5, 2), 6);
  });
  it('reference smoothing rises faster than it falls and is capped', () => {
    expect(updateReferenceE1rm(100, 110)).toBeCloseTo(105, 6);
    expect(updateReferenceE1rm(100, 200)).toBeCloseTo(105, 6); // +5% cap
    expect(updateReferenceE1rm(100, 90)).toBeCloseTo(97, 6);
    expect(updateReferenceE1rm(100, 10)).toBeCloseTo(92.5, 6); // −7.5% cap
    expect(updateReferenceE1rm(null, 90)).toBe(90);
  });
});

describe('rounding & units', () => {
  const bench = getExercise('bench_press');
  const db = getExercise('incline_db_press');
  it('rounds to nearest increment, ties go down', () => {
    expect(roundToIncrement(82.7, 2.5)).toBe(82.5);
    expect(roundToIncrement(83.75, 2.5)).toBe(82.5);
    expect(roundToIncrement(83.8, 2.5)).toBe(85);
  });
  it('barbell 2.5kg, micro plates 1.25kg, dumbbells 2kg', () => {
    expect(roundLoadKg(82.7, bench, 'kg')).toBe(82.5);
    expect(roundLoadKg(82.7, bench, 'kg', 1.25)).toBe(82.5);
    expect(roundLoadKg(83.3, bench, 'kg', 1.25)).toBe(83.75);
    expect(roundLoadKg(25.1, db, 'kg')).toBe(26);
  });
  it('lb users get a 5lb grid', () => {
    const kg = roundLoadKg(100, bench, 'lb');
    expect(kgToLb(kg)).toBeCloseTo(220, 6);
  });
  it('kg ↔ lb round trip is lossless before display rounding', () => {
    for (const v of [1, 2.5, 82.5, 102.3, 250]) expect(lbToKg(kgToLb(v))).toBeCloseTo(v, 10);
  });
  it('formats without trailing zeros', () => {
    expect(formatLoad(82.5, 'kg')).toBe('82.5');
    expect(formatLoad(100, 'kg')).toBe('100');
  });
});
