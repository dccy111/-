import { FOCUS_REGIONS } from '../data/muscles';
import { STRENGTH_EMPHASIS } from '../evidence/rules';
import type { DayPlan, DayType, MuscleGroup, RationaleItem, UserProfile, WeekLayout } from '../types';

export const DAY_GROUPS: Record<Exclude<DayType, 'focus' | 'rest'>, MuscleGroup[]> = {
  upper: ['chest', 'back', 'shoulders', 'biceps', 'triceps'],
  lower: ['quads', 'posterior', 'calves', 'core'],
  push: ['chest', 'shoulders', 'triceps'],
  pull: ['back', 'biceps'],
  legs: ['quads', 'posterior', 'calves'],
  full: ['chest', 'back', 'shoulders', 'quads', 'posterior'],
};

export const DAY_TYPE_LABEL: Record<DayType, string> = {
  upper: 'Upper', lower: 'Lower', push: 'Push', pull: 'Pull', legs: 'Legs', full: '전신', focus: '부위 집중', rest: '휴식',
};

/** Groups trained (as a primary target) on a planned day. */
export function groupsOf(plan: DayPlan): MuscleGroup[] {
  if (plan.type === 'rest') return [];
  if (plan.type === 'focus') {
    const set = new Set<MuscleGroup>();
    for (const r of plan.focus ?? []) FOCUS_REGIONS.find((f) => f.id === r)?.groups.forEach((g) => set.add(g));
    return [...set];
  }
  return DAY_GROUPS[plan.type];
}

export function dayLabel(plan: DayPlan): string {
  if (plan.type === 'focus') {
    return (plan.focus ?? []).map((r) => FOCUS_REGIONS.find((f) => f.id === r)?.nameKo ?? r).join(' + ') || '부위 집중';
  }
  return DAY_TYPE_LABEL[plan.type];
}

export interface SplitTemplate {
  id: string;
  nameKo: string;
  days: 3 | 4 | 5 | 6;
  layout: WeekLayout; // Mon..Sun
}

const d = (t: DayType): DayPlan => ({ type: t });
const R = d('rest');

export const SPLIT_TEMPLATES: SplitTemplate[] = [
  { id: 'fb3', nameKo: '전신 ×3', days: 3, layout: [d('full'), R, d('full'), R, d('full'), R, R] },
  { id: 'ul_fb3', nameKo: '상체/하체 + 전신', days: 3, layout: [d('upper'), R, d('lower'), R, d('full'), R, R] },
  { id: 'ppl3', nameKo: '밀기/당기기/하체', days: 3, layout: [d('push'), R, d('pull'), R, d('legs'), R, R] },
  { id: 'ul4', nameKo: '상체/하체 ×2', days: 4, layout: [d('upper'), d('lower'), R, d('upper'), d('lower'), R, R] },
  { id: 'fb4', nameKo: '전신 ×4', days: 4, layout: [d('full'), d('full'), R, d('full'), d('full'), R, R] },
  { id: 'ppl_u4', nameKo: '밀기/당기기/하체 + 상체', days: 4, layout: [d('push'), d('pull'), R, d('legs'), d('upper'), R, R] },
  { id: 'ul_ppl5', nameKo: '상체/하체 + 밀기/당기기/하체', days: 5, layout: [d('upper'), d('lower'), R, d('push'), d('pull'), d('legs'), R] },
  { id: 'ul2_fb5', nameKo: '상체/하체 ×2 + 전신', days: 5, layout: [d('upper'), d('lower'), R, d('upper'), d('lower'), d('full'), R] },
  { id: 'ppl5', nameKo: '밀기/당기기/하체 (5일 순환)', days: 5, layout: [d('push'), d('pull'), R, d('legs'), d('push'), d('pull'), R] },
  { id: 'ppl6', nameKo: '밀기/당기기/하체 ×2', days: 6, layout: [d('push'), d('pull'), d('legs'), d('push'), d('pull'), d('legs'), R] },
  { id: 'ul6', nameKo: '상체/하체 ×3', days: 6, layout: [d('upper'), d('lower'), d('upper'), d('lower'), d('upper'), d('lower'), R] },
];

export const MAJOR_GROUPS: MuscleGroup[] = ['chest', 'back', 'shoulders', 'quads', 'posterior'];

export function groupFrequency(layout: WeekLayout): Record<MuscleGroup, number> {
  const f = { chest: 0, back: 0, shoulders: 0, biceps: 0, triceps: 0, quads: 0, posterior: 0, calves: 0, core: 0 } as Record<MuscleGroup, number>;
  for (const p of layout) for (const g of groupsOf(p)) f[g] += 1;
  return f;
}

/** Pairs of consecutive calendar days (incl. Sun→Mon) that train an overlapping group. */
export function adjacentOverlaps(layout: WeekLayout): { a: number; b: number; groups: MuscleGroup[] }[] {
  const out: { a: number; b: number; groups: MuscleGroup[] }[] = [];
  for (let i = 0; i < 7; i++) {
    const j = (i + 1) % 7;
    const ga = groupsOf(layout[i]);
    const gb = new Set(groupsOf(layout[j]));
    const shared = ga.filter((g) => gb.has(g));
    if (shared.length) out.push({ a: i, b: j, groups: shared });
  }
  return out;
}

const trainingDays = (layout: WeekLayout) => layout.filter((p) => p.type !== 'rest').length;

/** Ideal number of distinct groups per session for the available time (heuristic). */
function idealGroups(minutes: number) {
  return minutes / 11; // 30→2.7, 45→4.1, 60→5.5, 90→8.2
}

export interface SplitCandidate {
  template: SplitTemplate;
  score: number;
  checks: RationaleItem[]; // ✓ items
  warnings: RationaleItem[]; // ! items
}

/**
 * Score every template with the right number of days. Weighted sum of:
 * muscle frequency, main-lift practice (× strength emphasis), recovery (adjacent overlap),
 * time fit (groups per session vs session length) and simplicity (novices).
 */
export function rankSplits(profile: Pick<UserProfile, 'daysPerWeek' | 'sessionMinutes' | 'goal' | 'trainingAge'>): SplitCandidate[] {
  const strength = STRENGTH_EMPHASIS[profile.goal];
  const ideal = idealGroups(profile.sessionMinutes);
  return SPLIT_TEMPLATES.filter((t) => t.days === profile.daysPerWeek)
    .map((template) => {
      const freq = groupFrequency(template.layout);
      const freqScore = MAJOR_GROUPS.filter((g) => freq[g] >= 2).length / MAJOR_GROUPS.length;
      const practice = ['chest', 'quads', 'posterior'].filter((g) => freq[g as MuscleGroup] >= 2).length / 3;
      const overlaps = adjacentOverlaps(template.layout).length;
      const recovery = 1 - Math.min(1, overlaps / Math.max(1, trainingDays(template.layout) - 1));
      const sessions = template.layout.filter((p) => p.type !== 'rest');
      const timeFit =
        sessions.reduce((acc, p) => {
          const n = groupsOf(p).filter((g) => g !== 'calves' && g !== 'core').length;
          return acc + Math.min(n, ideal) / Math.max(n, ideal);
        }, 0) / sessions.length;
      const distinct = new Set(sessions.map((p) => p.type)).size;
      const simplicity = 1 / distinct;
      const simplicityW = profile.trainingAge === 'novice' ? 1.5 : 0.3;
      const score = 3 * freqScore + 1.5 * strength * practice + 2 * recovery + 2.5 * timeFit + simplicityW * simplicity;

      const checks: RationaleItem[] = [];
      const warnings: RationaleItem[] = [];
      if (freqScore === 1) checks.push({ code: 'SPLIT_ALL_FREQ2', level: 'moderate' });
      else
        for (const g of MAJOR_GROUPS)
          if (freq[g] < 2) warnings.push({ code: 'SPLIT_LOW_FREQ', params: { group: g, n: freq[g] }, level: 'moderate' });
      if (timeFit >= 0.7) checks.push({ code: 'SPLIT_TIME_FIT', params: { minutes: profile.sessionMinutes }, level: 'heuristic' });
      if (overlaps > 0) warnings.push({ code: 'SPLIT_ADJACENT', params: { n: overlaps }, level: 'low' });
      return { template, score: +score.toFixed(4), checks, warnings };
    })
    .sort((a, b) => b.score - a.score || a.template.id.localeCompare(b.template.id));
}

// ---------------- Custom split validation ----------------

export interface SplitIssue {
  code: 'ADJACENT_SAME_GROUP' | 'LOW_FREQUENCY' | 'DAY_COUNT_MISMATCH';
  days?: number[];
  groups?: MuscleGroup[];
  fix?: { kind: 'swap'; a: number; b: number } | { kind: 'add_focus'; day: number; region: string };
}

export function validateLayout(layout: WeekLayout, daysPerWeek: number): SplitIssue[] {
  const issues: SplitIssue[] = [];
  for (const o of adjacentOverlaps(layout)) issues.push({ code: 'ADJACENT_SAME_GROUP', days: [o.a, o.b], groups: o.groups });
  const freq = groupFrequency(layout);
  for (const g of MAJOR_GROUPS) if (freq[g] > 0 && freq[g] < 2) issues.push({ code: 'LOW_FREQUENCY', groups: [g] });
  const n = trainingDays(layout);
  if (n !== daysPerWeek) issues.push({ code: 'DAY_COUNT_MISMATCH', days: [n] });

  // Deterministic one-tap fix for adjacency: best single adjacent swap.
  const adj = issues.filter((i) => i.code === 'ADJACENT_SAME_GROUP');
  if (adj.length) {
    const base = adjacentOverlaps(layout).length;
    let best: { a: number; b: number; score: number } | null = null;
    for (let i = 0; i < 7; i++) {
      const j = (i + 1) % 7;
      if (layout[i].type === 'rest' && layout[j].type === 'rest') continue;
      const swapped = layout.slice();
      [swapped[i], swapped[j]] = [swapped[j], swapped[i]];
      const s = adjacentOverlaps(swapped).length;
      if (s < base && (!best || s < best.score)) best = { a: Math.min(i, j), b: Math.max(i, j), score: s };
    }
    if (best) adj[0].fix = { kind: 'swap', a: best.a, b: best.b };
  }
  // Low frequency fix: add the missing region to a focus day with room.
  for (const issue of issues.filter((i) => i.code === 'LOW_FREQUENCY')) {
    const g = issue.groups![0];
    const region = FOCUS_REGIONS.find((r) => r.groups.includes(g) && r.groups.length >= 1)!;
    const day = layout.findIndex((p) => p.type === 'focus' && (p.focus?.length ?? 0) < 3);
    if (day >= 0) issue.fix = { kind: 'add_focus', day, region: region.id };
  }
  return issues;
}
