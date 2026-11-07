import { getExercise } from '../data/exercises';
import { e1rm, rirForEstimate } from '../load/e1rm';
import type { LoggedSet } from '../types';

export type PrType = 'max_load' | 'reps_at_load' | 'e1rm' | 'session_volume';

export interface PrRecord {
  exerciseId: string;
  type: PrType;
  value: number;
  loadKg: number;
  reps: number;
  date: string;
}

export interface ExerciseHistoryEntry {
  date: string;
  sets: LoggedSet[];
}

const working = (sets: LoggedSet[]) => sets.filter((s) => s.type === 'working' && s.reps > 0);

export function sessionVolumeKg(sets: LoggedSet[], bodyweightKg = 0): number {
  return working(sets).reduce((a, s) => a + (s.loadKg + bodyweightKg) * s.reps, 0);
}

export function bestE1rm(sets: LoggedSet[], targetRir: number, bodyweightKg = 0): number | null {
  let best: number | null = null;
  for (const s of working(sets)) {
    const rir = rirForEstimate(s, targetRir);
    if (s.reps + rir > 12) continue;
    const v = e1rm(s.loadKg + bodyweightKg, s.reps, rir);
    if (best == null || v > best) best = v;
  }
  return best;
}

/** Strictly-greater comparisons: equalling a record is not a PR. Warm-ups never count. */
export function detectPrs(
  exerciseId: string,
  history: ExerciseHistoryEntry[],
  today: ExerciseHistoryEntry,
  targetRir: number,
  bodyweightKg = 0,
): PrRecord[] {
  const ex = getExercise(exerciseId);
  const bw = ex.bodyweightLoaded ? bodyweightKg : 0;
  const prevSets = history.flatMap((h) => working(h.sets));
  const todaySets = working(today.sets);
  if (!todaySets.length) return [];
  const out: PrRecord[] = [];
  const first = history.length === 0;

  const maxLoadPrev = prevSets.reduce((a, s) => Math.max(a, s.loadKg), -Infinity);
  const top = todaySets.reduce((a, s) => (s.loadKg > a.loadKg || (s.loadKg === a.loadKg && s.reps > a.reps) ? s : a));
  if (!first && top.loadKg > maxLoadPrev) out.push({ exerciseId, type: 'max_load', value: top.loadKg, loadKg: top.loadKg, reps: top.reps, date: today.date });

  for (const s of todaySets) {
    const prevAtLoad = prevSets.filter((p) => Math.abs(p.loadKg - s.loadKg) < 1e-6).reduce((a, p) => Math.max(a, p.reps), -Infinity);
    if (!first && prevAtLoad > -Infinity && s.reps > prevAtLoad && !out.some((o) => o.type === 'reps_at_load')) {
      out.push({ exerciseId, type: 'reps_at_load', value: s.reps, loadKg: s.loadKg, reps: s.reps, date: today.date });
    }
  }

  if (ex.oneRmApplicable) {
    const prevBest = history.reduce((a, h) => Math.max(a, bestE1rm(h.sets, targetRir, bw) ?? 0), 0);
    const nowBest = bestE1rm(today.sets, targetRir, bw);
    if (!first && nowBest != null && nowBest > prevBest + 1e-6 && prevBest > 0) {
      out.push({ exerciseId, type: 'e1rm', value: nowBest, loadKg: top.loadKg, reps: top.reps, date: today.date });
    }
  }

  const prevVol = history.reduce((a, h) => Math.max(a, sessionVolumeKg(h.sets, bw)), 0);
  const vol = sessionVolumeKg(today.sets, bw);
  if (!first && vol > prevVol) out.push({ exerciseId, type: 'session_volume', value: vol, loadKg: top.loadKg, reps: top.reps, date: today.date });
  return out;
}

/** Percentage change helper; null when there is not enough data. */
export function pctChange(from: number | null | undefined, to: number | null | undefined): number | null {
  if (from == null || to == null || from <= 0) return null;
  return ((to - from) / from) * 100;
}

/** Monday-based week start (YYYY-MM-DD) for a local date string. */
export function weekStart(dateIso: string): string {
  const d = new Date(dateIso.slice(0, 10) + 'T00:00:00');
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return toIsoDate(d);
}

export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function addDays(dateIso: string, n: number): string {
  const d = new Date(dateIso.slice(0, 10) + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return toIsoDate(d);
}
