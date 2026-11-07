import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import type { UserProfile } from '../engine/types';
import { buildSteps, createProgram, finishSession, getActiveProgram, logSet, nextWorkout, planFor, recordSafety, saveOneRms, saveProfile, setRir, startSession } from './useCases';

const profile: UserProfile = {
  goal: 'strength_hypertrophy', daysPerWeek: 5, sessionMinutes: 60, trainingAge: 'intermediate',
  unit: 'kg', barbellIncrementKg: 2.5, rirPrompt: 'every_set',
};

async function setup() {
  await db.delete();
  await db.open();
  await saveProfile(profile);
  await saveOneRms([{ exerciseId: 'bench_press', kg: 102 }, { exerciseId: 'back_squat', kg: 120 }, { exerciseId: 'deadlift', load: 140, reps: 5 }]);
  return createProgram();
}

/** Do a whole session: every set as prescribed (or with a custom rep function), fixed RIR. */
async function doSession(dayIdx: number, rir: number, reps?: (exIdx: number, set: number, target: number) => number) {
  const program = (await getActiveProgram())!;
  const s = await startSession(program, program.days[dayIdx]);
  for (const step of buildSteps(s.plan)) {
    const p = s.plan[step.ex];
    const load = p.loadKg ?? 20;
    const target = p.reps[step.set];
    const row = await logSet(s, step, load, reps ? reps(step.ex, step.set, target) : target);
    await setRir(row.id, rir);
  }
  return { session: s, result: await finishSession(s.id) };
}

describe('Program → Execute → Record → Adapt loop', () => {
  beforeEach(async () => { await setup(); });

  it('first bench session is 82.5kg × 5 × 4; hitting it at RIR 2 sets 85kg next time', async () => {
    const program = (await getActiveProgram())!;
    const plan = await planFor(program.days[0]);
    expect(plan[0]).toMatchObject({ exerciseId: 'bench_press', loadKg: 82.5, sets: 4, reps: [5, 5, 5, 5], restSec: 180 });
    const { result } = await doSession(0, 2);
    expect(result[0].next).toMatchObject({ loadKg: 85, reps: [5, 5, 5, 5] });
    const again = await planFor(program.days[0]);
    expect(again[0].loadKg).toBe(85);
  });

  it('missing reps on the main lift reduces reps next time and nothing is auto-increased', async () => {
    const { result } = await doSession(0, 0, (ex, set, t) => (ex === 0 ? [5, 5, 4, 3][set] : t));
    expect(result[0].next).toMatchObject({ loadKg: 82.5, reps: [4, 4, 4, 4] });
  });

  it('rotation advances to the next day after a completed session', async () => {
    const program = (await getActiveProgram())!;
    expect(nextWorkout(program, await db.sessions.toArray())!.day.label).toBe('Upper A');
    await doSession(0, 2);
    expect(nextWorkout(program, await db.sessions.toArray())!.day.label).toBe('Lower A');
  });

  it('e1RM reference and PRs are recorded', async () => {
    await doSession(0, 2);
    const ref1 = (await db.refs.get('bench_press'))!.oneRmKg;
    await doSession(0, 2);
    const ref2 = (await db.refs.get('bench_press'))!.oneRmKg;
    expect(ref2).toBeGreaterThanOrEqual(ref1);
    expect((await db.prs.where('exerciseId').equals('bench_press').toArray()).some((p) => p.type === 'max_load')).toBe(true);
  });

  it('calibration exercises learn a load from the first session', async () => {
    const program = (await getActiveProgram())!;
    const before = await planFor(program.days[0]);
    const calIdx = before.findIndex((p) => p.loadKg == null);
    expect(calIdx).toBeGreaterThan(0);
    await doSession(0, 2);
    const after = await planFor(program.days[0]);
    expect(after[calIdx].loadKg).not.toBeNull();
  });

  it('sharp pain: that exercise is not learned from; red flags exclude the session', async () => {
    const program = (await getActiveProgram())!;
    const s = await startSession(program, program.days[0]);
    const row = await logSet(s, { ex: 0, set: 0 }, 82.5, 5);
    await setRir(row.id, 3);
    await recordSafety((await db.sessions.get(s.id))!, 0, 'sharp_pain');
    const res = await finishSession(s.id);
    expect(res[0].ruleCode).toBe('MAIN_EXCLUDED');
    expect((await db.refs.get('bench_press'))!.oneRmKg).toBe(102);
  });

  it('regenerating the program (split change) keeps learned loads', async () => {
    await doSession(0, 2);
    const layout = (await getActiveProgram())!.layout.slice();
    layout[5] = { type: 'focus', focus: ['shoulders', 'arms'] };
    const p2 = await createProgram({ layout, custom: true });
    const plan = await planFor(p2.days[0]);
    expect(plan[0]).toMatchObject({ exerciseId: 'bench_press', loadKg: 85 });
    expect(p2.days.find((d) => d.plan.type === 'focus')!.label).toBe('어깨 + 팔');
  });
});
