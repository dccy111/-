import type { EvidenceLevel, Goal, Role, TrainingAge } from '../types';

/**
 * Evidence Base — every numeric default the engine uses lives here, with its evidence level.
 * Ranges are starting points, not laws. The engine reads only from this module.
 */
export interface EvidenceRule {
  id: string;
  variable: string;
  recommendation: string;
  level: EvidenceLevel;
  sourceIds: string[];
  population: string;
  limitation: string;
}

export const RULES: EvidenceRule[] = [
  { id: 'strength_load', variable: 'strength_load', recommendation: '최대근력 향상에는 비교적 높은 부하(대략 80% 1RM 이상)가 유리한 경향', level: 'high', sourceIds: ['acsm2026', 'lopez2021', 'currier2023'], population: '건강한 성인', limitation: '주로 비고급자·단기 연구' },
  { id: 'hypertrophy_load', variable: 'hypertrophy_load', recommendation: '실패에 가깝게 수행하면 넓은 부하 범위에서 비슷한 근비대', level: 'high', sourceIds: ['lopez2021', 'currier2023'], population: '건강한 성인', limitation: '아주 낮은 부하는 시간·불편감 증가' },
  { id: 'hypertrophy_volume', variable: 'weekly_sets', recommendation: '주간 세트가 늘수록 근비대가 커지되 수확체감. 주 10세트 전후는 출발점 기준선 중 하나', level: 'moderate', sourceIds: ['schoenfeld2017vol', 'pelland_volume', 'acsm2026'], population: '훈련 경험자 포함', limitation: '개인차 큼, 최적 상한 불확실' },
  { id: 'frequency', variable: 'frequency', recommendation: '볼륨이 같다면 빈도 자체의 효과는 작음 — 볼륨을 나누는 수단으로 사용', level: 'moderate', sourceIds: ['schoenfeld2016freq', 'pelland_volume'], population: '건강한 성인', limitation: '세션당 볼륨 상한 근거 부족' },
  { id: 'proximity_to_failure', variable: 'rir', recommendation: '근비대는 실패 근접이 중요하나 매번 실패할 필요는 없음. 근력은 실패 여부 영향이 작음', level: 'moderate', sourceIds: ['refalo_failure'], population: '건강한 성인', limitation: 'RIR 자가보고 오차' },
  { id: 'rest_strength', variable: 'rest', recommendation: '근력 목적 고중량은 2~3분 이상 휴식이 유리', level: 'moderate', sourceIds: ['grgic2018rest'], population: '훈련 경험자 포함', limitation: '' },
  { id: 'rest_hypertrophy', variable: 'rest', recommendation: '60초보다 긴 휴식이 약간 유리, 약 90초 이후 차이는 작음', level: 'low', sourceIds: ['singer2024rest'], population: '건강한 성인', limitation: '연구 수 적음' },
  { id: 'rir_accuracy', variable: 'rir_trust', recommendation: '경험이 많고 실패에 가까울수록 RIR 추정이 정확', level: 'moderate', sourceIds: ['zourdos2016rir', 'helms2016rir'], population: '훈련 경험자', limitation: '' },
  { id: 'maintenance', variable: 'maintenance', recommendation: '강도를 유지하면 낮은 볼륨으로도 일정 기간 근력·근육 유지 가능', level: 'moderate', sourceIds: ['spiering2021'], population: '건강한 성인', limitation: '감량 상황 직접 근거 제한' },
  { id: 'progression_increment', variable: 'increment', recommendation: '목표 반복을 넘기면 2~10% 범위에서 증량', level: 'low', sourceIds: ['acsm2009'], population: '건강한 성인', limitation: '' },
  { id: 'deload', variable: 'deload', recommendation: '고정 주기보다 필요 기반, 볼륨 감소 중심', level: 'low', sourceIds: ['bell2023deload'], population: '근력·체형 종목 코치 합의', limitation: '실험 근거 부족' },
  { id: 'thresholds', variable: 'progression_thresholds', recommendation: '결과 분류 임계값(완료율 90%, RIR ±1)', level: 'heuristic', sourceIds: ['practice'], population: '-', limitation: '기록으로 튜닝 필요' },
  { id: 'time_constants', variable: 'time', recommendation: '반복당 3~4초, 운동 전환 90초, 메인 워밍업 6분', level: 'heuristic', sourceIds: ['practice'], population: '-', limitation: '' },
];

// ---------------- Prescription zones ----------------

export type Component = 'S' | 'H' | 'P' | 'M'; // strength / hypertrophy / power / maintain

export interface Zone {
  reps: [number, number];
  rir: [number, number];
  sets: [number, number];
  restSec: number;
}

/** Zone per goal component × slot role. evidence: see RULES above (strength_load, hypertrophy_load, rest_*). */
export const ZONES: Record<Component, Record<Role, Zone>> = {
  S: {
    main: { reps: [3, 6], rir: [1, 3], sets: [3, 5], restSec: 180 },
    secondary: { reps: [5, 8], rir: [1, 3], sets: [3, 4], restSec: 180 },
    isolation: { reps: [8, 12], rir: [1, 3], sets: [2, 3], restSec: 90 },
  },
  H: {
    main: { reps: [6, 10], rir: [1, 3], sets: [3, 4], restSec: 150 },
    secondary: { reps: [8, 12], rir: [1, 3], sets: [3, 4], restSec: 120 },
    isolation: { reps: [10, 15], rir: [0, 2], sets: [3, 4], restSec: 90 },
  },
  P: {
    main: { reps: [2, 5], rir: [3, 5], sets: [3, 5], restSec: 180 },
    secondary: { reps: [4, 6], rir: [2, 4], sets: [2, 3], restSec: 150 },
    isolation: { reps: [8, 12], rir: [2, 3], sets: [2, 3], restSec: 75 },
  },
  M: {
    main: { reps: [4, 8], rir: [2, 3], sets: [2, 3], restSec: 180 },
    secondary: { reps: [6, 10], rir: [2, 3], sets: [2, 3], restSec: 120 },
    isolation: { reps: [10, 15], rir: [1, 3], sets: [2, 3], restSec: 75 },
  },
};

/**
 * Goal profile as per-role component weights (not if/else). For mixed goals the main lift leans
 * toward strength while accessories lean toward hypertrophy ("block mixing" inside a session).
 */
export const GOAL_WEIGHTS: Record<Goal, Record<Role, Partial<Record<Component, number>>>> = {
  strength: { main: { S: 1 }, secondary: { S: 0.7, H: 0.3 }, isolation: { S: 0.3, H: 0.7 } },
  hypertrophy: { main: { S: 0.3, H: 0.7 }, secondary: { H: 1 }, isolation: { H: 1 } },
  strength_hypertrophy: { main: { S: 0.8, H: 0.2 }, secondary: { S: 0.4, H: 0.6 }, isolation: { H: 1 } },
  recomp: { main: { S: 0.4, M: 0.6 }, secondary: { H: 0.4, M: 0.6 }, isolation: { H: 0.3, M: 0.7 } },
  power: { main: { P: 0.8, S: 0.2 }, secondary: { S: 0.6, P: 0.4 }, isolation: { H: 0.6, M: 0.4 } },
};

/** Overall strength emphasis used by split choice and FAIL handling. */
export const STRENGTH_EMPHASIS: Record<Goal, number> = {
  strength: 0.9, strength_hypertrophy: 0.6, power: 0.6, recomp: 0.4, hypertrophy: 0.2,
};

/** Weekly hard-set starting points per muscle, before goal multiplier. evidence: moderate */
export const VOLUME_BASE: Record<TrainingAge, [number, number]> = {
  novice: [8, 12],
  intermediate: [10, 16],
  advanced: [12, 18],
};

/** evidence: moderate (maintenance) / low (others) */
export const GOAL_VOLUME_MULTIPLIER: Record<Goal, number> = {
  hypertrophy: 1.0, strength_hypertrophy: 0.9, strength: 0.7, recomp: 0.65, power: 0.55,
};

/** Weighted hard sets for one muscle in one session before spreading to another day. evidence: low */
export const SESSION_MUSCLE_CAP = 10;

export interface AgeModifier {
  rirShift: number; // added to target RIR (novices further from failure)
  rirTrust: number; // shrink self-reported RIR toward target
  difficultyCap: 1 | 2 | 3;
  lowerIncrementSteps: number; // novice lower body linear progression gets 2 steps
  minIsolationRir: number;
}

export const AGE_MODIFIERS: Record<TrainingAge, AgeModifier> = {
  novice: { rirShift: 1, rirTrust: 0.5, difficultyCap: 2, lowerIncrementSteps: 2, minIsolationRir: 1 },
  intermediate: { rirShift: 0, rirTrust: 0.8, difficultyCap: 3, lowerIncrementSteps: 1, minIsolationRir: 0 },
  advanced: { rirShift: 0, rirTrust: 1, difficultyCap: 3, lowerIncrementSteps: 1, minIsolationRir: 0 },
};

/** Time constants (evidence: heuristic). */
export const TIME = {
  generalWarmupSec: (minutes: number) => Math.min(300, minutes * 6), // 30min → 3min, ≥50 → 5min
  mainWarmupSec: 360,
  barbellWarmupSec: 150,
  transitionSec: 90,
  supersetSwitchSec: 30,
};

/** Progression thresholds (evidence: heuristic). */
export const THRESHOLDS = {
  partialCompletion: 0.9, // completion ≥ 90% but < 100% → partial
  exceedRirDelta: 1,
  grindRirDelta: -0.5,
  maxIncreaseSteps: 2,
  failReducePct: { min: 0.025, max: 0.05 },
  doubleBelowMinReducePct: 0.075,
  e1rmMaxRepsPlusRir: 12,
  e1rmAlphaUp: 0.5,
  e1rmAlphaDown: 0.3,
  e1rmMaxUpPct: 0.05,
  e1rmMaxDownPct: 0.075,
  restIncreaseSec: 30,
  restDecreaseSec: 15,
};

export const ENGINE_VERSION = '0.1.0';
