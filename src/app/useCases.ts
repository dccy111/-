import { adjustExercise, initialState } from '../engine/adjust/progression';
import { addDays, bestE1rm, detectPrs, pctChange, sessionVolumeKg, toIsoDate, weekStart } from '../engine/analytics/records';
import { getExercise } from '../engine/data/exercises';
import { e1rm } from '../engine/load/e1rm';
import { generateProgram } from '../engine/prescription/generateProgram';
import type { LoadReference, Program, ProgramDay, ProgressionState, Readiness, SafetyType, ScheduleMode, UserProfile, WeekLayout } from '../engine/types';
import { actionFor } from '../engine/safety/painFlags';
import { db, getMeta, setMeta, type PlannedExercise, type RefRow, type SessionRow, type SetRow } from '../db/db';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const todayIso = () => toIsoDate(new Date());
export const weekdayIndex = (iso: string) => (new Date(iso + 'T00:00:00').getDay() + 6) % 7; // Mon=0

export async function getProfile() {
  return getMeta<UserProfile>('profile');
}

export async function getActiveProgram(): Promise<Program | undefined> {
  const id = await getMeta<string>('activeProgramId');
  return id ? db.programs.get(id) : undefined;
}

async function engineRefs(): Promise<Record<string, LoadReference>> {
  const rows = await db.refs.toArray();
  return Object.fromEntries(rows.map((r) => [r.exerciseId, { exerciseId: r.exerciseId, oneRmKg: r.oneRmKg, source: r.source, updatedAt: r.updatedAt }]));
}

export interface OneRmInput { exerciseId: string; kg?: number; load?: number; reps?: number }

/** Accept either a known 1RM or a recent "load × reps" which becomes an estimated 1RM. */
export async function saveOneRms(inputs: OneRmInput[]) {
  const now = new Date().toISOString();
  for (const i of inputs) {
    if (i.kg && i.kg > 0) {
      await db.refs.put({ exerciseId: i.exerciseId, oneRmKg: i.kg, source: 'tested', testedKg: i.kg, testedAt: now.slice(0, 10), updatedAt: now });
    } else if (i.load && i.reps && i.load > 0 && i.reps > 0 && i.reps <= 12) {
      await db.refs.put({ exerciseId: i.exerciseId, oneRmKg: e1rm(i.load, i.reps), source: 'estimated', updatedAt: now });
    }
  }
}

/**
 * Regenerating a program (split/goal/time change) must not lose what the user has learned:
 * progression states carry over by exercise (+ role). Main lifts are re-derived from the 1RM reference
 * when `refreshMain` is set (e.g. the user entered a new tested 1RM).
 */
export async function createProgram(opts: { layout?: WeekLayout; splitId?: string; scheduleMode?: ScheduleMode; custom?: boolean; refreshMain?: boolean } = {}) {
  const profile = (await getProfile())!;
  const refs = await engineRefs();
  const prev = await getActiveProgram();
  const prevStates = prev ? await db.states.bulkGet(prev.days.flatMap((d) => d.slots.map((s) => s.id))) : [];
  const prevSlots = prev ? prev.days.flatMap((d) => d.slots) : [];
  const programId = uid();
  const program = generateProgram(profile, refs, {
    programId,
    now: new Date().toISOString(),
    layout: opts.layout,
    splitId: opts.splitId,
    splitSource: opts.custom ? 'custom' : undefined,
    scheduleMode: opts.scheduleMode,
  });
  await db.transaction('rw', db.programs, db.states, db.meta, async () => {
    await db.programs.put(program);
    for (const d of program.days)
      for (const s of d.slots) {
        const fresh = initialState(s);
        const i = prevSlots.findIndex((o, k) => o.exerciseId === s.exerciseId && o.role === s.role && prevStates[k]?.nextLoadKg != null);
        const old = i >= 0 ? prevStates[i] : undefined;
        const canCarry = old && (s.progression === 'double' || (!opts.refreshMain && prevSlots[i].targetReps === s.targetReps));
        if (old && canCarry) {
          const reps = Array.from({ length: s.sets }, (_, k) => Math.min(s.repMax, Math.max(s.repMin, old.nextReps[k] ?? old.nextReps[old.nextReps.length - 1] ?? s.targetReps)));
          await db.states.put({ ...fresh, nextLoadKg: old.nextLoadKg, nextReps: s.progression === 'load_rir' ? old.nextReps.slice(0, s.sets) : reps, stallCount: old.stallCount, failCount: old.failCount });
        } else await db.states.put(fresh);
      }
    await setMeta('activeProgramId', program.id);
  });
  return program;
}

export async function saveProfile(profile: UserProfile) {
  await setMeta('profile', profile);
}

// ---------------- Scheduling ----------------

export interface NextWorkout {
  day: ProgramDay;
  date: string;
  isToday: boolean;
  doneToday: boolean;
}

export function nextWorkout(program: Program, sessions: SessionRow[], today = todayIso()): NextWorkout | null {
  if (!program.days.length) return null;
  const done = sessions.filter((s) => s.programId === program.id && s.status === 'completed').sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const doneToday = done.some((s) => s.date === today);
  if (program.scheduleMode === 'rotation') {
    const last = done[done.length - 1];
    const lastSeq = last ? program.days.find((d) => d.id === last.dayId)?.seq ?? -1 : -1;
    const day = program.days[(lastSeq + 1) % program.days.length];
    return { day, date: today, isToday: true, doneToday };
  }
  for (let i = 0; i < 7; i++) {
    const date = addDays(today, i);
    const wd = weekdayIndex(date);
    const day = program.days.find((d) => d.weekday === wd);
    if (!day) continue;
    if (i === 0 && done.some((s) => s.date === today && s.dayId === day.id)) continue;
    return { day, date, isToday: i === 0, doneToday };
  }
  return { day: program.days[0], date: today, isToday: false, doneToday };
}

/** Today's prescription = program slot + live progression state. */
export async function planFor(day: ProgramDay): Promise<PlannedExercise[]> {
  const states = await db.states.bulkGet(day.slots.map((s) => s.id));
  return day.slots.map((slot, i) => {
    const st = states[i] ?? initialState(slot);
    return {
      slotId: slot.id,
      exerciseId: slot.exerciseId,
      role: slot.role,
      sets: Math.min(st.nextSets, slot.sets),
      reps: Array.from({ length: Math.min(st.nextSets, slot.sets) }, (_, k) => st.nextReps[k] ?? st.nextReps[st.nextReps.length - 1] ?? slot.targetReps),
      loadKg: st.nextLoadKg,
      restSec: st.restSec,
      repMin: slot.repMin,
      repMax: slot.repMax,
      rirMin: slot.rirMin,
      rirMax: slot.rirMax,
      supersetGroup: slot.supersetGroup,
      calibration: st.nextLoadKg == null,
    };
  });
}

export interface Step { ex: number; set: number }

/** Set order. Superset partners alternate A1 B1 A2 B2 … */
export function buildSteps(plan: PlannedExercise[]): Step[] {
  const steps: Step[] = [];
  const done = new Set<number>();
  plan.forEach((p, i) => {
    if (done.has(i)) return;
    const j = p.supersetGroup ? plan.findIndex((q, k) => k !== i && q.supersetGroup === p.supersetGroup) : -1;
    if (j > i) {
      done.add(j);
      const rounds = Math.max(p.sets, plan[j].sets);
      for (let r = 0; r < rounds; r++) {
        if (r < p.sets) steps.push({ ex: i, set: r });
        if (r < plan[j].sets) steps.push({ ex: j, set: r });
      }
    } else for (let r = 0; r < p.sets; r++) steps.push({ ex: i, set: r });
    done.add(i);
  });
  return steps;
}

export async function startSession(program: Program, day: ProgramDay, readiness?: Readiness): Promise<SessionRow> {
  const existing = await db.sessions.where('status').equals('in_progress').first();
  if (existing) return existing;
  const plan = await planFor(day);
  const session: SessionRow = {
    id: uid(),
    programId: program.id,
    dayId: day.id,
    date: todayIso(),
    startedAt: new Date().toISOString(),
    readiness,
    status: 'in_progress',
    plan,
    cursor: 0,
  };
  await db.sessions.put(session);
  return session;
}

export async function logSet(session: SessionRow, step: Step, loadKg: number, reps: number): Promise<SetRow> {
  const p = session.plan[step.ex];
  const row: SetRow = {
    id: uid(),
    sessionId: session.id,
    exerciseId: p.exerciseId,
    slotId: p.slotId,
    date: session.date,
    completedAt: new Date().toISOString(),
    setIdx: step.set,
    type: 'working',
    targetLoadKg: p.loadKg,
    targetReps: p.reps[step.set] ?? p.reps[0],
    loadKg,
    reps,
    rir: null,
  };
  await db.sets.put(row);
  return row;
}

export async function setRir(setId: string, rir: number) {
  await db.sets.update(setId, { rir });
}

export async function recordSafety(session: SessionRow, exIdx: number | null, type: SafetyType) {
  await db.safety.put({ id: uid(), sessionId: session.id, exerciseId: exIdx != null ? session.plan[exIdx].exerciseId : undefined, type, createdAt: new Date().toISOString() });
  const action = actionFor(type);
  const plan = session.plan.map((p, i) => (i === exIdx || action === 'end_session' ? { ...p, safety: type } : p));
  await db.sessions.update(session.id, { plan, safety: action === 'end_session' ? type : session.safety });
  return action;
}

// ---------------- Finish & adapt ----------------

export interface FinishedExercise {
  exerciseId: string;
  slotId: string;
  sets: SetRow[];
  volumeKg: number;
  prs: string[];
  next?: { loadKg: number | null; reps: number[]; sets: number };
  ruleCode?: string;
  bestE1rmKg: number | null;
}

export async function finishSession(sessionId: string): Promise<FinishedExercise[]> {
  const session = (await db.sessions.get(sessionId))!;
  const profile = (await getProfile())!;
  const program = (await db.programs.get(session.programId))!;
  const slotById = new Map(program.days.flatMap((d) => d.slots).map((s) => [s.id, s]));
  const allSets = await db.sets.where('sessionId').equals(sessionId).toArray();
  const out: FinishedExercise[] = [];
  const now = new Date().toISOString();

  for (const p of session.plan) {
    const sets = allSets.filter((s) => s.slotId === p.slotId).sort((a, b) => a.setIdx - b.setIdx);
    const slot = slotById.get(p.slotId);
    const ex = getExercise(p.exerciseId);
    const bw = ex.bodyweightLoaded ? profile.bodyweightKg ?? 0 : 0;
    const rirMid = (p.rirMin + p.rirMax) / 2;
    const fin: FinishedExercise = { exerciseId: p.exerciseId, slotId: p.slotId, sets, volumeKg: sessionVolumeKg(sets, bw), prs: [], bestE1rmKg: ex.oneRmApplicable ? bestE1rm(sets, rirMid, bw) : null };
    if (!slot || !sets.length) { out.push(fin); continue; }

    // PRs vs previous history of this exercise
    const prevSets = (await db.sets.where('exerciseId').equals(p.exerciseId).toArray()).filter((s) => s.sessionId !== sessionId);
    const byDate = new Map<string, SetRow[]>();
    prevSets.forEach((s) => byDate.set(s.sessionId, [...(byDate.get(s.sessionId) ?? []), s]));
    const history = [...byDate.values()].map((ss) => ({ date: ss[0].date, sets: ss }));
    const prs = p.safety ? [] : detectPrs(p.exerciseId, history, { date: session.date, sets }, rirMid, profile.bodyweightKg ?? 0);
    for (const pr of prs) await db.prs.put({ ...pr, id: uid(), sessionId });
    fin.prs = prs.map((x) => x.type);

    // Adjustment
    const before: ProgressionState = (await db.states.get(slot.id)) ?? initialState(slot);
    const ref = await db.refs.get(p.exerciseId);
    const exclude = !!p.safety && actionFor(p.safety) !== 'freeze_progression';
    const result = adjustExercise({
      profile,
      slot,
      state: before,
      sets,
      readiness: session.readiness,
      referenceE1rmKg: ref?.oneRmKg ?? null,
      excludeFromLearning: exclude,
    });
    if (p.safety && actionFor(p.safety) === 'freeze_progression') {
      result.state.nextLoadKg = Math.max(...sets.map((s) => s.loadKg));
      result.state.painHold = true;
      result.ruleCode = slot.progression === 'load_rir' ? 'MAIN_PAIN_HOLD' : 'DOUBLE_PAIN_HOLD';
    }
    await db.states.put(result.state);
    await db.adjustLog.put({ id: uid(), sessionId, slotId: slot.id, exerciseId: p.exerciseId, ruleCode: result.ruleCode, before, after: result.state, createdAt: now });
    if (ex.oneRmApplicable && result.referenceE1rmKg && !exclude) {
      const row: RefRow = { exerciseId: p.exerciseId, oneRmKg: result.referenceE1rmKg, source: ref?.source === 'tested' ? 'tested' : 'estimated', testedKg: ref?.testedKg, testedAt: ref?.testedAt, updatedAt: now };
      await db.refs.put(row);
    }
    // Keep other slots that use the same exercise (e.g. a volume day) in sync when they have no load yet
    for (const other of program.days.flatMap((d) => d.slots)) {
      if (other.id === slot.id || other.exerciseId !== slot.exerciseId) continue;
      const st = await db.states.get(other.id);
      if (st && st.nextLoadKg == null && result.state.nextLoadKg != null) await db.states.put({ ...st, nextLoadKg: result.state.nextLoadKg });
    }
    await db.summaries.put({
      key: `${sessionId}|${slot.id}`, sessionId, exerciseId: p.exerciseId, slotId: slot.id, date: session.date,
      bestE1rmKg: fin.bestE1rmKg, volumeKg: fin.volumeKg, workingSets: sets.length, outcome: result.outcome, ruleCode: result.ruleCode,
    });
    fin.next = { loadKg: result.state.nextLoadKg, reps: result.state.nextReps, sets: result.state.nextSets };
    fin.ruleCode = result.ruleCode;
    out.push(fin);
  }
  await db.sessions.update(sessionId, { status: 'completed', endedAt: now, restEndsAt: undefined });
  return out;
}

export async function abandonSession(sessionId: string) {
  const sets = await db.sets.where('sessionId').equals(sessionId).count();
  if (sets === 0) {
    await db.sessions.delete(sessionId);
    return;
  }
  await finishSession(sessionId);
}

// ---------------- Dashboard ----------------

export interface Dashboard {
  weekDone: number;
  weekTarget: number;
  strength?: { exerciseId: string; changePct: number; e1rm: number };
  volumeChangePct?: number;
}

export async function dashboard(program: Program, today = todayIso()): Promise<Dashboard> {
  const ws = weekStart(today);
  const sessions = await db.sessions.where('status').equals('completed').toArray();
  const weekDone = sessions.filter((s) => s.date >= ws).length;
  const summaries = await db.summaries.toArray();

  // Strength: main lift with largest e1RM change over ~4 weeks (needs ≥ 2 data points)
  const since = addDays(today, -28);
  const mains = new Set(program.days.flatMap((d) => d.slots.filter((s) => s.role === 'main').map((s) => s.exerciseId)));
  let strength: Dashboard['strength'];
  for (const id of mains) {
    const pts = summaries.filter((s) => s.exerciseId === id && s.bestE1rmKg).sort((a, b) => a.date.localeCompare(b.date));
    const recent = pts.filter((p) => p.date >= since);
    const base = recent[0] ?? pts[0];
    const last = pts[pts.length - 1];
    if (!base || !last || base === last) continue;
    const ch = pctChange(base.bestE1rmKg, last.bestE1rmKg);
    if (ch != null && (!strength || Math.abs(ch) > Math.abs(strength.changePct))) strength = { exerciseId: id, changePct: ch, e1rm: last.bestE1rmKg! };
  }

  const vol = (from: string, to: string) => summaries.filter((s) => s.date >= from && s.date < to).reduce((a, s) => a + s.volumeKg, 0);
  const thisWeek = vol(ws, addDays(ws, 7));
  const prev = [1, 2, 3].map((k) => vol(addDays(ws, -7 * k), addDays(ws, -7 * (k - 1)))).filter((v) => v > 0);
  const avg = prev.length ? prev.reduce((a, b) => a + b, 0) / prev.length : 0;
  return { weekDone, weekTarget: program.days.length, strength, volumeChangePct: avg > 0 && thisWeek > 0 ? ((thisWeek - avg) / avg) * 100 : undefined };
}

export async function resetAll() {
  await db.delete();
  location.reload();
}
