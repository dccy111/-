import { getExercise } from '../data/exercises';
import { TIME } from '../evidence/rules';
import type { SlotPrescription } from '../types';

function workSec(slot: SlotPrescription): number {
  const ex = getExercise(slot.exerciseId);
  const reps = Math.max(slot.targetReps, Math.round((slot.repMin + slot.repMax) / 2));
  const perSide = ex.equipment === 'dumbbell' && ex.pattern === 'lunge' ? 2 : 1;
  return ex.setupSec + reps * ex.repDurationSec * perSide;
}

function warmupSec(slot: SlotPrescription, firstCompound: boolean): number {
  if (!slot.warmup) return 0;
  if (slot.role === 'main') return firstCompound ? TIME.mainWarmupSec : TIME.mainWarmupSec / 2;
  return TIME.barbellWarmupSec;
}

/**
 * Session time = general warm-up + Σ(exercise warm-up + sets × work + (sets−1) × rest) + transitions.
 * A superset pair alternates A/B: each round = workA + switch + workB, rest once per round.
 */
export function estimateSessionSec(slots: SlotPrescription[], sessionMinutes: number): number {
  let total = TIME.generalWarmupSec(sessionMinutes);
  const seen = new Set<string>();
  let blocks = 0;
  let firstCompound = true;
  const ordered = [...slots].sort((a, b) => a.order - b.order);
  for (const s of ordered) {
    if (seen.has(s.id)) continue;
    blocks++;
    const partner = s.supersetGroup ? ordered.find((o) => o.id !== s.id && o.supersetGroup === s.supersetGroup) : undefined;
    if (partner) {
      seen.add(partner.id);
      const rounds = Math.max(s.sets, partner.sets);
      const rest = Math.max(s.restSec, partner.restSec);
      total += s.sets * workSec(s) + partner.sets * workSec(partner) + rounds * TIME.supersetSwitchSec + (rounds - 1) * rest;
    } else {
      total += warmupSec(s, firstCompound) + s.sets * workSec(s) + (s.sets - 1) * s.restSec;
      if (s.warmup) firstCompound = false;
    }
    seen.add(s.id);
  }
  total += Math.max(0, blocks - 1) * TIME.transitionSec;
  return total;
}

export const estimateMinutes = (slots: SlotPrescription[], sessionMinutes: number) =>
  Math.round(estimateSessionSec(slots, sessionMinutes) / 60);

/** Two slots can be supersetted if neither is a main lift / barbell compound and they share no primary muscle. */
function canPair(a: SlotPrescription, b: SlotPrescription): boolean {
  if (a.role === 'main' || b.role === 'main' || a.supersetGroup || b.supersetGroup) return false;
  const ea = getExercise(a.exerciseId);
  const eb = getExercise(b.exerciseId);
  if (ea.equipment === 'barbell' && ea.mechanic === 'compound') return false;
  if (eb.equipment === 'barbell' && eb.mechanic === 'compound') return false;
  if (a.role !== 'isolation' && b.role !== 'isolation') return false;
  const pa = new Set(ea.muscles.filter((m) => m.role === 'primary').map((m) => m.muscle));
  return !eb.muscles.some((m) => m.role === 'primary' && pa.has(m.muscle)) && ea.pattern !== eb.pattern;
}

export interface FitResult {
  slots: SlotPrescription[];
  estMinutes: number;
  log: string[];
}

/**
 * Hard constraint: estimated time ≤ selected minutes. Steps applied one at a time, re-estimating after each:
 * 1) isolation sets −1 (min 2)  2) superset accessories  3) secondary sets −1 (min 2)
 * 4) drop lowest-priority isolation, then secondary  5) isolation rest → 60s
 * 6) main sets down to core (min 3)  7) last resort: drop secondary-main / main sets to 2.
 * Main core sets are never touched before step 6.
 */
export function fitToTimeBudget(input: SlotPrescription[], minutes: number, priorities: Record<string, number>): FitResult {
  let slots = input.map((s) => ({ ...s }));
  const log: string[] = [];
  const limit = minutes * 60;
  const over = () => estimateSessionSec(slots, minutes) > limit;
  const byLowPriority = (role: SlotPrescription['role']) =>
    slots.filter((s) => s.role === role).sort((a, b) => (priorities[a.id] ?? 0) - (priorities[b.id] ?? 0) || b.order - a.order);

  const reduceSets = (role: SlotPrescription['role'], code: string) => {
    let changed = true;
    while (over() && changed) {
      changed = false;
      for (const s of byLowPriority(role)) {
        if (!over()) break;
        if (s.sets > s.minSets) {
          s.sets -= 1;
          changed = true;
          log.push(code);
        }
      }
    }
  };

  if (over()) reduceSets('isolation', 'TRIM_ISOLATION_SETS');
  if (over()) {
    let g = 0;
    const pool = slots.filter((s) => s.role !== 'main').sort((a, b) => a.order - b.order);
    for (let i = 0; i < pool.length && over(); i++) {
      for (let j = i + 1; j < pool.length && over(); j++) {
        if (canPair(pool[i], pool[j])) {
          const id = `ss${++g}`;
          pool[i].supersetGroup = id;
          pool[j].supersetGroup = id;
          // keep the pair adjacent in order
          pool[j].order = pool[i].order + 0.5;
          log.push('TRIM_SUPERSET');
          break;
        }
      }
    }
  }
  if (over()) reduceSets('secondary', 'TRIM_SECONDARY_SETS');
  for (const role of ['isolation', 'secondary'] as const) {
    while (over()) {
      const victim = byLowPriority(role)[0];
      if (!victim) break;
      slots = slots.filter((s) => s.id !== victim.id);
      if (victim.supersetGroup) slots.forEach((s) => s.supersetGroup === victim.supersetGroup && delete s.supersetGroup);
      log.push(role === 'isolation' ? 'TRIM_DROP_ISOLATION' : 'TRIM_DROP_SECONDARY');
    }
  }
  if (over()) for (const s of slots) if (s.role === 'isolation' && s.restSec > 60) { s.restSec = 60; log.push('TRIM_SHORTEN_REST'); }
  if (over()) reduceSets('main', 'TRIM_MAIN_TO_CORE');
  while (over()) {
    const mains = slots.filter((s) => s.role === 'main');
    if (mains.length > 1) {
      const victim = mains.sort((a, b) => b.order - a.order)[0];
      slots = slots.filter((s) => s.id !== victim.id);
      log.push('TRIM_DROP_SECOND_MAIN');
      continue;
    }
    const m = mains[0];
    if (m && m.sets > 2) { m.sets -= 1; log.push('TRIM_MAIN_BELOW_CORE'); continue; }
    if (m && m.restSec > 150) { m.restSec -= 30; log.push('TRIM_MAIN_REST'); continue; }
    break;
  }
  slots.sort((a, b) => a.order - b.order).forEach((s, i) => (s.order = i));
  return { slots, estMinutes: estimateMinutes(slots, minutes), log };
}
