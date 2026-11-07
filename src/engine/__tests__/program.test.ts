import { describe, expect, it } from 'vitest';
import { getExercise } from '../data/exercises';
import { generateProgram } from '../prescription/generateProgram';
import { blendZone } from '../prescription/prescribe';
import { rankSplits, validateLayout } from '../prescription/split';
import { estimateSessionSec, fitToTimeBudget } from '../prescription/timeBudget';
import { addSetsToVolume, performedVolume, volumeTargets, type VolumeMap } from '../prescription/volume';
import type { Goal, LoadReference, TrainingAge, WeekLayout } from '../types';
import { profile, sets, slot } from './helpers';

const refs: Record<string, LoadReference> = {
  bench_press: { exerciseId: 'bench_press', oneRmKg: 102, source: 'tested' },
  back_squat: { exerciseId: 'back_squat', oneRmKg: 120, source: 'tested' },
  deadlift: { exerciseId: 'deadlift', oneRmKg: 163, source: 'estimated' },
};
const GOALS: Goal[] = ['strength', 'hypertrophy', 'strength_hypertrophy', 'recomp', 'power'];
const AGES: TrainingAge[] = ['novice', 'intermediate', 'advanced'];
const DAYS = [3, 4, 5, 6] as const;
const MINUTES = [30, 45, 60, 90] as const;

describe('goal blending', () => {
  it('strength+hypertrophy main lift ≈ 5 reps @ RIR 1–3, 4 sets, 3 min', () => {
    const z = blendZone('strength_hypertrophy', 'main', 'intermediate');
    expect(z).toMatchObject({ targetReps: 5, rirMin: 1, rirMax: 3, sets: 4, restSec: 180 });
  });
  it('strength main is heavier (fewer reps) than hypertrophy main', () => {
    expect(blendZone('strength', 'main', 'intermediate').targetReps).toBeLessThan(blendZone('hypertrophy', 'main', 'intermediate').targetReps);
  });
  it('novices keep more reps in reserve', () => {
    expect(blendZone('hypertrophy', 'isolation', 'novice').rirMin).toBeGreaterThan(blendZone('hypertrophy', 'isolation', 'advanced').rirMin);
  });
});

describe('program generation', () => {
  const p = profile();
  const prog = generateProgram(p, refs, { programId: 'p', now: '2026-11-07' });

  it('is deterministic', () => {
    const again = generateProgram(p, refs, { programId: 'p', now: '2026-11-07' });
    expect(again).toEqual(prog);
  });
  it('5 days · 60 min · S+H → upper/lower + push/pull/legs', () => {
    expect(prog.splitId).toBe('ul_ppl5');
    expect(prog.days.map((d) => d.label)).toEqual(['Upper A', 'Lower A', 'Push A', 'Pull A', 'Legs A']);
  });
  it('bench 1RM 102 → 82.5kg × 5 × 4, rest 3:00 (spec example)', () => {
    const bench = prog.days[0].slots[0];
    expect(bench).toMatchObject({ exerciseId: 'bench_press', loadKg: 82.5, targetReps: 5, sets: 4, restSec: 180, progression: 'load_rir' });
  });
  it('strength goal main lifts use higher %1RM than hypertrophy goal', () => {
    const avgPct = (goal: Goal) => {
      const g = generateProgram(profile({ goal }), refs, { programId: 'g', now: '' });
      const pcts = g.days.flatMap((d) => d.slots.filter((s) => s.role === 'main' && s.pct1rm).map((s) => s.pct1rm!));
      return pcts.reduce((a, b) => a + b, 0) / pcts.length;
    };
    expect(avgPct('strength')).toBeGreaterThan(avgPct('hypertrophy'));
  });
  it('still generates without any 1RM (calibration on first set)', () => {
    const g = generateProgram(p, {}, { programId: 'n', now: '' });
    expect(g.days.length).toBe(5);
    expect(g.days.flatMap((d) => d.slots).every((s) => s.loadKg === null || s.loadKg === 0)).toBe(true);
    expect(g.rationale.some((r) => r.code === 'CALIBRATION')).toBe(true);
  });
  it('accessory loads derived from related lifts are marked as estimates', () => {
    const incline = prog.days.flatMap((d) => d.slots).find((s) => s.exerciseId === 'incline_db_press');
    expect(incline?.loadSource).toBe('derived_ratio');
  });
  it('main exercises precede accessories in every day', () => {
    for (const d of prog.days) {
      const roles = d.slots.map((s) => s.role);
      const firstNonMain = roles.findIndex((r) => r !== 'main');
      expect(roles.slice(firstNonMain).includes('main')).toBe(false);
    }
  });
  it('heavy deadlifts are not used as accessories', () => {
    const accessoryDl = prog.days.flatMap((d) => d.slots).filter((s) => s.exerciseId === 'deadlift' && s.role !== 'main');
    expect(accessoryDl).toHaveLength(0);
  });
});

describe('time budget — every combination stays within the selected time', () => {
  for (const goal of GOALS)
    for (const age of AGES)
      it(`${goal} / ${age}`, () => {
        for (const days of DAYS)
          for (const minutes of MINUTES) {
            const g = generateProgram(profile({ goal, trainingAge: age, daysPerWeek: days, sessionMinutes: minutes }), refs, { programId: 't', now: '' });
            for (const d of g.days) {
              expect(estimateSessionSec(d.slots, minutes)).toBeLessThanOrEqual(minutes * 60);
              expect(d.slots.some((s) => s.role === 'main')).toBe(true);
            }
          }
      });

  it('compression order: isolation sets → superset → secondary sets, main core sets untouched', () => {
    const slots = [
      slot({ id: 'a', order: 0 }),
      slot({ id: 'b', order: 1, exerciseId: 'barbell_row', role: 'secondary', sets: 4, minSets: 2, restSec: 150, progression: 'double', warmup: false }),
      slot({ id: 'c', order: 2, exerciseId: 'lateral_raise', role: 'isolation', sets: 4, minSets: 2, restSec: 90, progression: 'double', warmup: false, targetReps: 12, repMin: 12, repMax: 15 }),
      slot({ id: 'd', order: 3, exerciseId: 'triceps_pushdown', role: 'isolation', sets: 4, minSets: 2, restSec: 90, progression: 'double', warmup: false, targetReps: 12, repMin: 12, repMax: 15 }),
      slot({ id: 'e', order: 4, exerciseId: 'ez_bar_curl', role: 'isolation', sets: 4, minSets: 2, restSec: 90, progression: 'double', warmup: false, targetReps: 12, repMin: 12, repMax: 15 }),
    ];
    const r = fitToTimeBudget(slots, 45, { a: 10, b: 9, c: 5, d: 4, e: 3 });
    expect(r.estMinutes).toBeLessThanOrEqual(45);
    const first = (code: string) => r.log.indexOf(code);
    if (first('TRIM_SUPERSET') >= 0) expect(first('TRIM_ISOLATION_SETS')).toBeLessThan(first('TRIM_SUPERSET'));
    if (first('TRIM_SECONDARY_SETS') >= 0 && first('TRIM_SUPERSET') >= 0) expect(first('TRIM_SUPERSET')).toBeLessThan(first('TRIM_SECONDARY_SETS'));
    expect(r.slots.find((s) => s.id === 'a')!.sets).toBe(4);
  });
  it('a program that already fits is left unchanged', () => {
    const s = [slot({ sets: 3 })];
    expect(fitToTimeBudget(s, 90, {}).log).toEqual([]);
  });
});

describe('weekly volume', () => {
  it('spec example: Bench 8 + Incline DB 6 + Dip 4 → chest 18', () => {
    const v: VolumeMap = {};
    addSetsToVolume(v, 'bench_press', 8);
    addSetsToVolume(v, 'incline_db_press', 6);
    addSetsToVolume(v, 'dip', 4);
    expect(v.chest).toBe(18);
    expect(v.triceps).toBe(8 * 0.5 + 6 * 0.5 + 4 * 1);
  });
  it('performed volume counts hard working sets only', () => {
    const s = sets(80, [5, 5, 5], [2, 5, null]);
    s.push({ setIdx: 9, type: 'warmup', targetLoadKg: 40, targetReps: 5, loadKg: 40, reps: 5, rir: 6 });
    expect(performedVolume([{ exerciseId: 'bench_press', sets: s }]).chest).toBe(2);
  });
  it('targets scale with goal and training age', () => {
    expect(volumeTargets('hypertrophy', 'advanced').chest![1]).toBeGreaterThan(volumeTargets('strength', 'novice').chest![1]);
  });
  it('hypertrophy programs reach the starting range for major muscles when time allows', () => {
    const g = generateProgram(profile({ goal: 'hypertrophy', daysPerWeek: 5, sessionMinutes: 90 }), refs, { programId: 'v', now: '' });
    for (const m of ['chest', 'lats', 'quads'] as const) expect(g.plannedVolume[m]!).toBeGreaterThanOrEqual(g.volumeTargets[m]![0]);
  });
  it('per-session muscle cap is respected', () => {
    for (const days of DAYS) {
      const g = generateProgram(profile({ goal: 'hypertrophy', daysPerWeek: days, sessionMinutes: 90 }), refs, { programId: 'c', now: '' });
      for (const d of g.days) {
        const v: VolumeMap = {};
        d.slots.forEach((s) => addSetsToVolume(v, s.exerciseId, s.sets));
        for (const m of ['chest', 'lats', 'quads', 'side_delt'] as const) expect(v[m] ?? 0).toBeLessThanOrEqual(10.5);
      }
    }
  });
});

describe('split selection', () => {
  const pick = (days: 3 | 4 | 5 | 6, sessionMinutes: 30 | 45 | 60 | 90) =>
    rankSplits({ daysPerWeek: days, sessionMinutes, goal: 'strength_hypertrophy', trainingAge: 'intermediate' });
  it('defaults: 3→full body, 4→upper/lower, 5→UL+PPL', () => {
    expect(pick(3, 60)[0].template.id).toBe('fb3');
    expect(pick(4, 60)[0].template.id).toBe('ul4');
    expect(pick(5, 60)[0].template.id).toBe('ul_ppl5');
  });
  it('returns ranked alternatives (≥ 2) for the UI', () => {
    for (const d of DAYS) expect(pick(d, 60).length).toBeGreaterThanOrEqual(2);
  });
  it('custom layout: legs → lower on consecutive days is flagged with a one-swap fix', () => {
    const layout: WeekLayout = [{ type: 'push' }, { type: 'pull' }, { type: 'legs' }, { type: 'lower' }, { type: 'upper' }, { type: 'rest' }, { type: 'rest' }];
    const issues = validateLayout(layout, 5);
    const adj = issues.find((i) => i.code === 'ADJACENT_SAME_GROUP')!;
    expect(adj.days).toEqual([2, 3]);
    expect(adj.fix?.kind).toBe('swap');
    const fix = adj.fix as { kind: 'swap'; a: number; b: number };
    expect(fix.b - fix.a).toBe(1);
    const fixed = layout.slice();
    [fixed[fix.a], fixed[fix.b]] = [fixed[fix.b], fixed[fix.a]];
    expect(validateLayout(fixed, 5).filter((i) => i.code === 'ADJACENT_SAME_GROUP')).toHaveLength(0);
  });
  it('custom layout: legs only once → low frequency warning', () => {
    const layout: WeekLayout = [{ type: 'upper' }, { type: 'lower' }, { type: 'rest' }, { type: 'push' }, { type: 'pull' }, { type: 'focus', focus: ['shoulders', 'arms'] }, { type: 'rest' }];
    const issues = validateLayout(layout, 5);
    expect(issues.some((i) => i.code === 'LOW_FREQUENCY' && i.groups?.includes('quads'))).toBe(true);
    expect(issues.find((i) => i.code === 'LOW_FREQUENCY' && i.groups?.includes('quads'))?.fix).toEqual({ kind: 'add_focus', day: 5, region: 'legs' });
  });
  it('focus days only use exercises for the chosen regions, and custom programs keep the time limit', () => {
    const layout: WeekLayout = [{ type: 'upper' }, { type: 'lower' }, { type: 'rest' }, { type: 'push' }, { type: 'pull' }, { type: 'focus', focus: ['shoulders', 'arms'] }, { type: 'rest' }];
    const g = generateProgram(profile(), refs, { programId: 'f', now: '', layout });
    const focus = g.days.find((d) => d.plan.type === 'focus')!;
    expect(focus.label).toBe('어깨 + 팔');
    const allowed = new Set(['front_delt', 'side_delt', 'rear_delt', 'biceps', 'triceps']);
    for (const s of focus.slots) expect(getExercise(s.exerciseId).muscles.some((m) => m.role === 'primary' && allowed.has(m.muscle))).toBe(true);
    for (const d of g.days) expect(estimateSessionSec(d.slots, 60)).toBeLessThanOrEqual(3600);
    expect(g.splitSource).toBe('custom');
    expect(g.scheduleMode).toBe('fixed_weekdays');
  });
});
