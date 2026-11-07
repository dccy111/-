import { EXERCISES, getExercise } from '../data/exercises';
import { FOCUS_REGIONS, MUSCLES, VOLUME_PRIORITY } from '../data/muscles';
import { AGE_MODIFIERS, ENGINE_VERSION, SESSION_MUSCLE_CAP, STRENGTH_EMPHASIS } from '../evidence/rules';
import { resolveReference } from '../load/startingLoad';
import type {
  DayPlan, Exercise, LoadReference, MuscleId, Program, ProgramDay, RationaleItem, ScheduleMode,
  SlotPrescription, SplitSource, UserProfile, WeekLayout,
} from '../types';
import { slotsForDay, type SlotTemplate } from './dayTemplates';
import { prescribeSlot } from './prescribe';
import { adjacentOverlaps, dayLabel, rankSplits, SPLIT_TEMPLATES, validateLayout } from './split';
import { fitToTimeBudget } from './timeBudget';
import { round1, slotVolume, volumeTargets, weeklyPlannedVolume, type VolumeMap } from './volume';

export interface GenerateOptions {
  programId: string;
  now: string; // ISO
  layout?: WeekLayout; // custom layout
  splitId?: string; // chosen template id
  splitSource?: SplitSource;
  scheduleMode?: ScheduleMode;
  excludedExercises?: string[];
}

interface Ctx {
  profile: UserProfile;
  refs: Record<string, LoadReference | undefined>;
  excluded: Set<string>;
  usedAsMain: Record<string, number>;
  usedAny: Record<string, number>;
}

function candidateScore(ex: Exercise, slot: SlotTemplate, ctx: Ctx, usedToday: Set<string>): number {
  const pIdx = slot.patterns.indexOf(ex.pattern);
  let score = -10 * pIdx - EXERCISES.indexOf(ex) * 0.01;
  if (usedToday.has(ex.id)) return -1e6;
  const hasRef = !!ctx.refs[ex.id];
  if (slot.role === 'main') {
    if (hasRef) score += 20;
    if (ex.equipment === 'barbell') score += 5;
    const prior = ctx.usedAsMain[ex.id] ?? 0;
    if (prior > 0) {
      const repeatOk = STRENGTH_EMPHASIS[ctx.profile.goal] >= 0.5 && ex.fatigueCost < 1.4;
      score += repeatOk ? -2 : -50;
    }
  } else {
    score -= 8 * (ctx.usedAny[ex.id] ?? 0);
    if (ex.fatigueCost >= 1.3) score -= 15; // heavy systemic lifts are kept for main slots
    if (hasRef && ex.oneRmApplicable) score += 1;
  }
  return score;
}

function pickExercise(slot: SlotTemplate, ctx: Ctx, usedToday: Set<string>): Exercise | null {
  const cap = AGE_MODIFIERS[ctx.profile.trainingAge].difficultyCap;
  const pool = EXERCISES.filter(
    (e) =>
      slot.patterns.includes(e.pattern) &&
      !ctx.excluded.has(e.id) &&
      (e.difficulty <= cap || !!ctx.refs[e.id]) &&
      (slot.role !== 'main' || (e.mechanic === 'compound' && e.oneRmApplicable)),
  );
  let best: Exercise | null = null;
  let bestScore = -Infinity;
  for (const e of pool) {
    const s = candidateScore(e, slot, ctx, usedToday);
    if (s > bestScore) [best, bestScore] = [e, s];
  }
  return bestScore <= -1e5 ? null : best;
}

/** Add/remove accessory sets so planned weekly volume sits inside the starting-point range. */
function rebalanceVolume(
  days: { slots: SlotPrescription[] }[],
  targets: Partial<Record<MuscleId, [number, number]>>,
  focusBonus: Set<MuscleId>,
) {
  const maxSets = (s: SlotPrescription) => (s.role === 'main' ? 5 : 4);
  const primaryOf = (s: SlotPrescription) => getExercise(s.exerciseId).muscles.filter((m) => m.role === 'primary').map((m) => m.muscle);
  for (let iter = 0; iter < 40; iter++) {
    const vol = weeklyPlannedVolume(days as ProgramDay[]);
    let changed = false;
    for (const [m, [lo, hi]] of Object.entries(targets) as [MuscleId, [number, number]][]) {
      const v = vol[m] ?? 0;
      const upper = hi + (focusBonus.has(m) ? 4 : 0);
      if (v < lo) {
        // add one set to the accessory with this primary muscle that has the most room, respecting session cap
        const options = days.flatMap((d) =>
          d.slots
            .filter((s) => primaryOf(s).includes(m) && s.sets < maxSets(s) && (s.role !== 'main' || s.progression === 'load_rir'))
            .filter(() => (slotVolume(d.slots)[m] ?? 0) + 1 <= SESSION_MUSCLE_CAP)
            .map((s) => ({ s })),
        );
        const rank = (r: SlotPrescription['role']) => (r === 'isolation' ? 0 : r === 'secondary' ? 1 : 2);
        const pick = options.sort((a, b) => rank(a.s.role) - rank(b.s.role) || a.s.sets - b.s.sets)[0];
        if (pick) { pick.s.sets += 1; changed = true; }
      } else if (v > upper) {
        const options = days.flatMap((d) => d.slots.filter((s) => s.role !== 'main' && primaryOf(s).includes(m) && s.sets > 2));
        const pick = options.sort((a, b) => (a.role === b.role ? b.sets - a.sets : a.role === 'isolation' ? -1 : 1))[0];
        if (pick) { pick.sets -= 1; changed = true; }
      }
    }
    // session cap: trim isolation sets if a muscle exceeds the per-session cap
    for (const d of days) {
      const sv = slotVolume(d.slots);
      for (const [m, v] of Object.entries(sv) as [MuscleId, number][]) {
        if (v > SESSION_MUSCLE_CAP) {
          const iso = d.slots.find((s) => s.role !== 'main' && primaryOf(s).includes(m) && s.sets > 2);
          if (iso) { iso.sets -= 1; changed = true; }
        }
      }
    }
    if (!changed) break;
  }
}

function focusMuscles(layout: WeekLayout): Set<MuscleId> {
  const out = new Set<MuscleId>();
  for (const p of layout) {
    if (p.type !== 'focus') continue;
    for (const r of p.focus ?? []) {
      const groups = FOCUS_REGIONS.find((f) => f.id === r)?.groups ?? [];
      for (const m of Object.keys(VOLUME_PRIORITY) as MuscleId[]) if (groups.includes(MUSCLES[m].group)) out.add(m);
    }
  }
  return out;
}

/**
 * When two consecutive calendar days train the same group (custom layouts), trim one accessory set
 * for that group on the second day (min 2). evidence: low (recovery heuristic)
 */
function reduceAdjacentOverlap(days: { weekday: number; slots: SlotPrescription[] }[], layout: WeekLayout) {
  for (const o of adjacentOverlaps(layout)) {
    const day = days.find((d) => d.weekday === o.b);
    if (!day) continue;
    for (const s of day.slots) {
      if (s.role === 'main') continue;
      const hit = getExercise(s.exerciseId).muscles.some((m) => m.role === 'primary' && o.groups.includes(MUSCLES[m.muscle].group));
      if (hit && s.sets > s.minSets) s.sets -= 1;
    }
  }
}

export function generateProgram(profile: UserProfile, refs: Record<string, LoadReference | undefined>, opts: GenerateOptions): Program {
  const ranked = rankSplits(profile);
  let layout: WeekLayout;
  let splitId: string;
  let splitSource: SplitSource = opts.splitSource ?? 'recommended';
  if (opts.layout) {
    layout = opts.layout;
    splitId = opts.splitId ?? 'custom';
    splitSource = opts.splitSource ?? 'custom';
  } else {
    const tpl = (opts.splitId && SPLIT_TEMPLATES.find((t) => t.id === opts.splitId)) || ranked[0].template;
    layout = tpl.layout;
    splitId = tpl.id;
    if (opts.splitId && opts.splitId !== ranked[0].template.id) splitSource = 'alternative';
  }

  const ctx: Ctx = { profile, refs, excluded: new Set(opts.excludedExercises ?? []), usedAsMain: {}, usedAny: {} };
  const occurrences: Record<string, number> = {};
  const rawDays: { weekday: number; plan: DayPlan; label: string; slots: SlotPrescription[]; priorities: Record<string, number> }[] = [];

  layout.forEach((plan, weekday) => {
    if (plan.type === 'rest') return;
    const key = plan.type === 'focus' ? `focus:${(plan.focus ?? []).join('+')}` : plan.type;
    const variant = occurrences[key] ?? 0;
    occurrences[key] = variant + 1;
    const templates = slotsForDay(plan, variant);
    const usedToday = new Set<string>();
    const slots: SlotPrescription[] = [];
    const priorities: Record<string, number> = {};
    templates.forEach((t, i) => {
      const ex = pickExercise(t, ctx, usedToday);
      if (!ex) return;
      usedToday.add(ex.id);
      const repeatMain = t.role === 'main' && (ctx.usedAsMain[ex.id] ?? 0) > 0;
      const slotId = `${opts.programId}:${weekday}:${i}`;
      const reference = resolveReference(ex.id, refs);
      slots.push(prescribeSlot({ slotId, exerciseId: ex.id, role: t.role, order: i, profile, reference, repShift: repeatMain ? 3 : 0 }));
      priorities[slotId] = t.priority;
      if (t.role === 'main') ctx.usedAsMain[ex.id] = (ctx.usedAsMain[ex.id] ?? 0) + 1;
      ctx.usedAny[ex.id] = (ctx.usedAny[ex.id] ?? 0) + 1;
    });
    const base = dayLabel(plan);
    const label = plan.type === 'focus' ? base : `${base} ${String.fromCharCode(65 + variant)}`;
    rawDays.push({ weekday, plan, label, slots, priorities });
  });

  const targets = volumeTargets(profile.goal, profile.trainingAge);
  rebalanceVolume(rawDays, targets, focusMuscles(layout));
  reduceAdjacentOverlap(rawDays, layout);

  const days: ProgramDay[] = rawDays.map((d, seq) => {
    const fit = fitToTimeBudget(d.slots, profile.sessionMinutes, d.priorities);
    return {
      id: `${opts.programId}:d${d.weekday}`,
      seq,
      weekday: d.weekday,
      plan: d.plan,
      label: d.label,
      slots: fit.slots,
      estMinutes: fit.estMinutes,
      trimLog: fit.log,
    };
  });

  const planned = weeklyPlannedVolume(days);
  const plannedRounded: VolumeMap = {};
  for (const [m, v] of Object.entries(planned) as [MuscleId, number][]) plannedRounded[m] = round1(v);

  const warnings: RationaleItem[] = [];
  for (const [m, [lo]] of Object.entries(targets) as [MuscleId, [number, number]][]) {
    const v = planned[m] ?? 0;
    if (v < lo) warnings.push({ code: 'VOLUME_BELOW_START', params: { muscle: m, sets: Math.round(v), lo }, level: 'moderate' });
  }
  if (opts.layout) for (const issue of validateLayout(layout, profile.daysPerWeek)) warnings.push({ code: `SPLIT_${issue.code}`, params: { days: (issue.days ?? []).join(','), groups: (issue.groups ?? []).join(',') }, level: 'low' });

  const rationale = buildRationale(profile, days, splitId, ranked, targets);
  return {
    id: opts.programId,
    createdAt: opts.now,
    engineVersion: ENGINE_VERSION,
    goal: profile.goal,
    splitId,
    splitSource,
    scheduleMode: opts.scheduleMode ?? (splitSource === 'custom' ? 'fixed_weekdays' : 'rotation'),
    layout,
    days,
    volumeTargets: targets,
    plannedVolume: plannedRounded,
    warnings,
    rationale,
    inputs: profile,
  };
}

function buildRationale(
  profile: UserProfile,
  days: ProgramDay[],
  splitId: string,
  ranked: ReturnType<typeof rankSplits>,
  targets: Partial<Record<MuscleId, [number, number]>>,
): RationaleItem[] {
  const out: RationaleItem[] = [];
  const mains = days.flatMap((d) => d.slots.filter((s) => s.role === 'main'));
  const main = mains[0];
  out.push({ code: `GOAL_${profile.goal.toUpperCase()}`, level: 'high' });
  if (main) {
    out.push({
      code: 'MAIN_PRESCRIPTION',
      params: { reps: main.targetReps, rirMin: main.rirMin, rirMax: main.rirMax, pct: main.pct1rm ? Math.round(main.pct1rm * 100) : 0, rest: main.restSec },
      level: 'high',
    });
  }
  const chest = targets.chest;
  if (chest) out.push({ code: 'VOLUME_START', params: { lo: chest[0], hi: chest[1] }, level: 'moderate' });
  const cand = ranked.find((c) => c.template.id === splitId);
  out.push({ code: 'SPLIT_REASON', params: { split: cand?.template.nameKo ?? '직접 구성', days: profile.daysPerWeek, minutes: profile.sessionMinutes, allFreq2: cand?.checks.some((c) => c.code === 'SPLIT_ALL_FREQ2') ? 1 : 0 }, level: 'moderate' });
  out.push({ code: 'REST_BY_LOAD', level: 'moderate' });
  if (days.some((d) => d.trimLog.length)) out.push({ code: 'TIME_TRIMMED', params: { minutes: profile.sessionMinutes }, level: 'heuristic' });
  const calib = days.flatMap((d) => d.slots).filter((s) => s.loadSource === 'calibration').length;
  if (calib) out.push({ code: 'CALIBRATION', params: { n: calib }, level: 'heuristic' });
  if (days.flatMap((d) => d.slots).some((s) => s.loadSource === 'derived_ratio')) out.push({ code: 'DERIVED_RATIO', level: 'low' });
  if (profile.trainingAge === 'novice') out.push({ code: 'NOVICE_RIR', level: 'moderate' });
  return out;
}
