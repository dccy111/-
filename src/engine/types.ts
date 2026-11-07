// Pure engine types. Nothing in src/engine may import React, Dexie or browser APIs.

export type Goal = 'strength' | 'hypertrophy' | 'strength_hypertrophy' | 'recomp' | 'power';
export type TrainingAge = 'novice' | 'intermediate' | 'advanced';
export type Role = 'main' | 'secondary' | 'isolation';
export type Unit = 'kg' | 'lb';
export type EvidenceLevel = 'high' | 'moderate' | 'low' | 'uncertain' | 'heuristic';

export type MuscleId =
  | 'chest' | 'lats' | 'upper_back' | 'front_delt' | 'side_delt' | 'rear_delt'
  | 'triceps' | 'biceps' | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'abs' | 'erectors';

/** Coarse groups used for split-level reasoning (frequency, adjacency). */
export type MuscleGroup =
  | 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' | 'quads' | 'posterior' | 'calves' | 'core';

export type Pattern =
  | 'squat' | 'hinge' | 'lunge' | 'leg_press' | 'hip_thrust'
  | 'horizontal_push' | 'incline_push' | 'vertical_push' | 'horizontal_pull' | 'vertical_pull'
  | 'knee_extension' | 'knee_flexion' | 'chest_fly' | 'lateral_raise' | 'rear_delt'
  | 'elbow_flexion' | 'elbow_extension' | 'calf_raise' | 'core' | 'back_extension';

export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight';

export interface MuscleContribution {
  muscle: MuscleId;
  role: 'primary' | 'secondary';
  contribution: number; // 1.0 primary / 0.5 secondary by default
}

export interface Exercise {
  id: string;
  nameKo: string;
  nameEn: string;
  pattern: Pattern;
  mechanic: 'compound' | 'isolation';
  equipment: Equipment;
  oneRmApplicable: boolean;
  bodyweightLoaded: boolean; // pull-up/dip: effective load = bodyweight + added
  perHand: boolean; // dumbbells: load shown per dumbbell
  repMin: number;
  repMax: number;
  restSec: number;
  incrementKg: number;
  repDurationSec: number;
  setupSec: number;
  difficulty: 1 | 2 | 3;
  fatigueCost: number; // relative systemic fatigue (low evidence)
  muscles: MuscleContribution[];
  /** Rough starting-load estimate from a related lift. evidence: low */
  ratioFrom?: { exerciseId: string; ratio: number };
}

export type DayType = 'upper' | 'lower' | 'push' | 'pull' | 'legs' | 'full' | 'focus' | 'rest';
export type FocusRegion = 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'glutes_hams' | 'calves' | 'core';

export interface DayPlan {
  type: DayType;
  focus?: FocusRegion[]; // when type === 'focus' (1–3)
}

/** 7 entries, index 0 = Monday. */
export type WeekLayout = DayPlan[];

export type ScheduleMode = 'rotation' | 'fixed_weekdays';
export type SplitSource = 'recommended' | 'alternative' | 'custom';

export interface UserProfile {
  goal: Goal;
  daysPerWeek: 3 | 4 | 5 | 6;
  sessionMinutes: 30 | 45 | 60 | 90;
  trainingAge: TrainingAge;
  unit: Unit;
  bodyweightKg?: number;
  barbellIncrementKg: number; // 2.5 default; 1.25 with micro plates
  rirPrompt: 'every_set' | 'last_set';
}

/** Best-known strength reference for an exercise. */
export interface LoadReference {
  exerciseId: string;
  oneRmKg: number;
  source: 'tested' | 'estimated' | 'derived_ratio';
  updatedAt?: string;
}

export type ProgressionModel = 'load_rir' | 'double';

export interface SlotPrescription {
  id: string; // stable slot id inside a program
  exerciseId: string;
  role: Role;
  order: number;
  sets: number;
  minSets: number;
  repMin: number;
  repMax: number;
  targetReps: number; // main: fixed target; double: starting target
  rirMin: number;
  rirMax: number;
  restSec: number;
  loadKg: number | null; // null => calibration (user picks first set)
  loadSource: LoadReference['source'] | 'calibration';
  pct1rm: number | null;
  progression: ProgressionModel;
  supersetGroup?: string;
  warmup: boolean;
}

export interface ProgramDay {
  id: string;
  seq: number; // order in rotation
  weekday: number | null; // 0=Mon … 6=Sun when fixed
  plan: DayPlan;
  label: string; // "Upper A"
  slots: SlotPrescription[];
  estMinutes: number;
  trimLog: string[]; // rationale codes for time compression
}

export interface RationaleItem {
  code: string;
  params?: Record<string, string | number>;
  level: EvidenceLevel;
}

export interface Program {
  id: string;
  createdAt: string;
  engineVersion: string;
  goal: Goal;
  splitId: string;
  splitSource: SplitSource;
  scheduleMode: ScheduleMode;
  layout: WeekLayout;
  days: ProgramDay[];
  volumeTargets: Partial<Record<MuscleId, [number, number]>>;
  plannedVolume: Partial<Record<MuscleId, number>>;
  warnings: RationaleItem[];
  rationale: RationaleItem[];
  inputs: UserProfile;
}

// ---------- Logging / adjustment ----------

export type Readiness = 1 | 2 | 3 | 4; // 4 good … 1 very tired

export interface LoggedSet {
  setIdx: number;
  type: 'warmup' | 'working';
  targetLoadKg: number | null;
  targetReps: number;
  loadKg: number;
  reps: number;
  rir: number | null; // 0..3 (3 = "3+"), null = not answered
}

export type Outcome = 'exceed' | 'success' | 'grind' | 'partial' | 'fail';

export interface ProgressionState {
  slotId: string;
  exerciseId: string;
  nextLoadKg: number | null;
  nextReps: number[]; // per-set targets
  nextSets: number;
  restSec: number;
  stallCount: number;
  failCount: number;
  partialStreak: number;
  belowMinStreak: number;
  lastOutcome?: Outcome;
  painHold?: boolean;
}

export type SafetyType =
  | 'pain_mild' | 'sharp_pain' | 'acute_injury' | 'dizziness' | 'chest_pain' | 'shortness_of_breath';
