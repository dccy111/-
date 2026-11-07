import { describe, expect, it } from 'vitest';
import { addDays, detectPrs, pctChange, sessionVolumeKg, weekStart } from '../analytics/records';
import { explain, numbersAreGrounded } from '../explain/templates.ko';
import { actionFor } from '../safety/painFlags';
import { sets } from './helpers';

describe('PRs', () => {
  const hist = [{ date: '2026-11-01', sets: sets(80, [5, 5, 5, 5], 2) }];
  it('82.5 × 5 after 80 × 5 → max load, e1RM and volume PR', () => {
    const prs = detectPrs('bench_press', hist, { date: '2026-11-05', sets: sets(82.5, [5, 5, 5, 5], 2) }, 2);
    expect(prs.map((p) => p.type).sort()).toEqual(['e1rm', 'max_load', 'session_volume']);
  });
  it('equal performance is not a PR', () => {
    expect(detectPrs('bench_press', hist, { date: '2026-11-05', sets: sets(80, [5, 5, 5, 5], 2) }, 2)).toEqual([]);
  });
  it('more reps at a known load → rep PR', () => {
    const prs = detectPrs('bench_press', hist, { date: '2026-11-05', sets: sets(80, [6, 5, 5, 5], 2) }, 2);
    expect(prs.some((p) => p.type === 'reps_at_load' && p.reps === 6)).toBe(true);
  });
  it('first ever session sets a baseline without PR noise', () => {
    expect(detectPrs('bench_press', [], { date: '2026-11-05', sets: sets(80, [5], 2) }, 2)).toEqual([]);
  });
  it('session volume = Σ load × reps (spec example 82.5 × 5 × 4 = 1650)', () => {
    expect(sessionVolumeKg(sets(82.5, [5, 5, 5, 5], 2))).toBe(1650);
  });
});

describe('dates & trends', () => {
  it('week starts on Monday', () => {
    expect(weekStart('2026-11-07')).toBe('2026-11-02'); // Saturday → Monday
    expect(weekStart('2026-11-02')).toBe('2026-11-02');
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
  });
  it('percentage change: 100 → 108 = +8%, missing data → null', () => {
    expect(pctChange(100, 108)).toBeCloseTo(8, 6);
    expect(pctChange(null, 108)).toBeNull();
  });
});

describe('explanations & safety', () => {
  it('template text uses only engine numbers', () => {
    const params = { lo: 10, hi: 16 };
    const text = explain({ code: 'VOLUME_START', params, level: 'moderate' });
    expect(text).toContain('10~16');
    expect(numbersAreGrounded(text, params)).toBe(true);
    expect(numbersAreGrounded('주 20세트', params)).toBe(false);
  });
  it('red-flag symptoms end the session; sharp pain ends the exercise', () => {
    expect(actionFor('chest_pain')).toBe('end_session');
    expect(actionFor('dizziness')).toBe('end_session');
    expect(actionFor('sharp_pain')).toBe('end_exercise');
    expect(actionFor('pain_mild')).toBe('freeze_progression');
  });
});
