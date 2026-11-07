import type { DayPlan, FocusRegion, Pattern, Role } from '../types';

export interface SlotTemplate {
  role: Role;
  patterns: Pattern[]; // ordered preference
  /** Can be dropped first when time is short (lower = dropped earlier). */
  priority: number;
}

const s = (role: Role, patterns: Pattern[], priority: number): SlotTemplate => ({ role, patterns, priority });

/**
 * Movement-pattern slots per day type. Variant B (second occurrence in a week) shifts the emphasis
 * so the same pattern is not trained identically twice.
 */
const TEMPLATES: Record<string, SlotTemplate[][]> = {
  upper: [
    [s('main', ['horizontal_push'], 10), s('secondary', ['horizontal_pull'], 9), s('secondary', ['vertical_push'], 7), s('secondary', ['vertical_pull'], 8), s('isolation', ['lateral_raise'], 5), s('isolation', ['chest_fly'], 4), s('isolation', ['elbow_extension'], 3), s('isolation', ['elbow_flexion'], 3)],
    [s('main', ['vertical_push', 'horizontal_push'], 10), s('secondary', ['vertical_pull'], 9), s('secondary', ['incline_push'], 8), s('secondary', ['horizontal_pull'], 7), s('isolation', ['rear_delt'], 4), s('isolation', ['elbow_flexion'], 3), s('isolation', ['elbow_extension'], 3)],
  ],
  lower: [
    [s('main', ['squat'], 10), s('secondary', ['hinge'], 9), s('secondary', ['leg_press', 'lunge'], 7), s('isolation', ['knee_flexion'], 6), s('isolation', ['calf_raise'], 4), s('isolation', ['core'], 3)],
    [s('main', ['hinge'], 10), s('secondary', ['squat', 'leg_press'], 9), s('secondary', ['lunge', 'hip_thrust'], 7), s('isolation', ['knee_extension'], 6), s('isolation', ['calf_raise'], 4), s('isolation', ['core'], 3)],
  ],
  push: [
    [s('main', ['horizontal_push'], 10), s('secondary', ['vertical_push'], 8), s('secondary', ['incline_push'], 7), s('isolation', ['lateral_raise'], 6), s('isolation', ['chest_fly'], 4), s('isolation', ['elbow_extension'], 5)],
    [s('main', ['vertical_push', 'horizontal_push'], 10), s('secondary', ['incline_push'], 8), s('secondary', ['horizontal_push'], 7), s('isolation', ['lateral_raise'], 6), s('isolation', ['chest_fly'], 4), s('isolation', ['elbow_extension'], 5)],
  ],
  pull: [
    [s('main', ['hinge', 'horizontal_pull'], 10), s('secondary', ['vertical_pull'], 9), s('secondary', ['horizontal_pull'], 8), s('isolation', ['rear_delt'], 5), s('isolation', ['elbow_flexion'], 6), s('isolation', ['elbow_flexion'], 3)],
    [s('main', ['horizontal_pull'], 10), s('secondary', ['vertical_pull'], 9), s('secondary', ['horizontal_pull'], 7), s('isolation', ['rear_delt'], 5), s('isolation', ['elbow_flexion'], 6), s('isolation', ['elbow_flexion'], 3)],
  ],
  legs: [
    [s('main', ['squat'], 10), s('secondary', ['hinge'], 9), s('secondary', ['leg_press', 'lunge'], 7), s('isolation', ['knee_extension'], 5), s('isolation', ['knee_flexion'], 6), s('isolation', ['calf_raise'], 4)],
    [s('main', ['squat', 'leg_press'], 10), s('secondary', ['hip_thrust', 'hinge'], 8), s('secondary', ['lunge'], 7), s('isolation', ['knee_flexion'], 6), s('isolation', ['knee_extension'], 5), s('isolation', ['calf_raise'], 4)],
  ],
  full: [
    [s('main', ['squat'], 10), s('main', ['horizontal_push'], 10), s('secondary', ['horizontal_pull'], 8), s('secondary', ['hinge'], 6), s('isolation', ['lateral_raise'], 4), s('isolation', ['elbow_flexion'], 3)],
    [s('main', ['hinge'], 10), s('main', ['vertical_push', 'horizontal_push'], 10), s('secondary', ['vertical_pull'], 8), s('secondary', ['leg_press', 'lunge'], 6), s('isolation', ['chest_fly'], 5), s('isolation', ['knee_flexion'], 4), s('isolation', ['elbow_extension'], 3)],
    [s('main', ['squat', 'leg_press'], 10), s('secondary', ['incline_push'], 9), s('secondary', ['horizontal_pull', 'vertical_pull'], 8), s('secondary', ['hip_thrust', 'hinge'], 6), s('isolation', ['rear_delt'], 4), s('isolation', ['calf_raise'], 3)],
  ],
};

const FOCUS_SLOTS: Record<FocusRegion, SlotTemplate[]> = {
  chest: [s('secondary', ['horizontal_push'], 9), s('secondary', ['incline_push'], 8), s('isolation', ['chest_fly'], 6)],
  back: [s('secondary', ['vertical_pull'], 9), s('secondary', ['horizontal_pull'], 8), s('isolation', ['rear_delt'], 5)],
  shoulders: [s('secondary', ['vertical_push'], 9), s('isolation', ['lateral_raise'], 7), s('isolation', ['rear_delt'], 6)],
  arms: [s('isolation', ['elbow_flexion'], 8), s('isolation', ['elbow_extension'], 8), s('isolation', ['elbow_flexion'], 6), s('isolation', ['elbow_extension'], 6)],
  legs: [s('secondary', ['squat', 'leg_press'], 9), s('secondary', ['hinge'], 8), s('isolation', ['knee_extension'], 6), s('isolation', ['knee_flexion'], 6)],
  glutes_hams: [s('secondary', ['hinge'], 9), s('secondary', ['hip_thrust'], 8), s('isolation', ['knee_flexion'], 7)],
  calves: [s('isolation', ['calf_raise'], 7), s('isolation', ['calf_raise'], 5)],
  core: [s('isolation', ['core'], 7), s('isolation', ['core'], 5)],
};

export function slotsForDay(plan: DayPlan, variant: number): SlotTemplate[] {
  if (plan.type === 'rest') return [];
  if (plan.type === 'focus') {
    const regions = plan.focus ?? [];
    // Interleave regions so a 3-region day still gets each region's top slot first.
    const lists = regions.map((r) => FOCUS_SLOTS[r]);
    const out: SlotTemplate[] = [];
    const maxLen = Math.max(0, ...lists.map((l) => l.length));
    for (let i = 0; i < maxLen; i++) for (const l of lists) if (l[i]) out.push(l[i]);
    // Compounds first, then isolation (exercise order rule).
    return out.sort((a, b) => (a.role === b.role ? 0 : a.role === 'secondary' ? -1 : 1));
  }
  const variants = TEMPLATES[plan.type];
  return variants[variant % variants.length];
}
