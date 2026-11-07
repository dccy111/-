import { GROUP_NAME_KO, MUSCLES } from '../data/muscles';
import type { EvidenceLevel, MuscleGroup, MuscleId, RationaleItem } from '../types';

/**
 * Rationale codes → short Korean sentences. Only numbers present in params are rendered,
 * so this layer can never invent a training number. (A future LLM layer must pass the same check:
 * see `numbersAreGrounded`.)
 */
const T: Record<string, (p: Record<string, string | number>) => string> = {
  GOAL_STRENGTH: () => '목표가 근력이라 메인 리프트를 비교적 무겁게, 적은 반복으로 구성했어요.',
  GOAL_HYPERTROPHY: () => '목표가 근비대라 다양한 무게를 쓰되, 근육별 주간 세트 수를 충분히 확보하는 데 집중했어요.',
  GOAL_STRENGTH_HYPERTROPHY: () =>
    '근력 + 근비대 목표라서 메인 리프트에는 비교적 높은 중량을 쓰고, 보조운동은 중간 반복수로 주간 볼륨을 확보했어요.',
  GOAL_RECOMP: () => '감량 중에는 강도(무게)를 유지하는 것이 근육 유지에 중요해서, 무게는 지키고 세트 수는 줄였어요.',
  GOAL_POWER: () => '파워 목표라 중간 무게를 빠르게 들어 올리고, 실패하지 않을 만큼 여유를 남기도록 했어요.',
  MAIN_PRESCRIPTION: (p) =>
    `메인 리프트는 ${p.reps}회를 ${p.rirMin}~${p.rirMax}개 남기는 무게${p.pct ? `(약 ${p.pct}% 1RM)` : ''}로, 휴식은 ${fmtRest(+p.rest)}이에요.`,
  VOLUME_START: (p) => `큰 근육은 주 ${p.lo}~${p.hi}세트 정도를 출발점으로 잡았어요. 기록이 쌓이면 조정해요.`,
  SPLIT_REASON: (p) =>
    `주 ${p.days}회 · ${p.minutes}분이라 ${p.split}로 나눴어요.${+p.allFreq2 ? ' 모든 주요 근육을 주 2회 이상 운동해요.' : ''}`,
  REST_BY_LOAD: () => '무거운 복합운동은 휴식을 길게, 고립운동은 짧게 잡았어요.',
  TIME_TRIMMED: (p) => `${p.minutes}분 안에 끝나도록 보조운동 세트를 줄이거나 슈퍼세트로 묶었어요. 메인 리프트는 그대로예요.`,
  CALIBRATION: (p) => `무게 기록이 없는 운동 ${p.n}개는 첫 세트에서 직접 무게를 고르면, 그다음부터 자동으로 맞춰져요.`,
  DERIVED_RATIO: () => '일부 운동은 관련 리프트 기록으로 시작 무게를 추정했어요(정확도 낮음, 첫 세트에서 조정).',
  NOVICE_RIR: () => '운동 경력이 짧아 실패 지점에서 조금 더 멀리 여유를 두도록 했어요.',
  // adjustment rules
  MAIN_SUCCESS_INCREASE: () => '목표 반복을 모두 해냈어요. 다음엔 무게를 한 단계 올려요.',
  MAIN_EXCEED_INCREASE: () => '목표보다 여유가 많았어요. 다음엔 무게를 조금 더 올려요.',
  MAIN_GRIND_HOLD: () => '다 했지만 한계에 가까웠어요. 같은 무게로 한 번 더 해요.',
  MAIN_PARTIAL_HOLD: () => '몇 회가 부족했어요. 같은 무게로 다시 도전해요.',
  MAIN_FAIL_REDUCE_REPS: () => '목표에 많이 못 미쳤어요. 무게는 유지하고 반복수를 1회 줄여요.',
  MAIN_FAIL_REDUCE_LOAD: () => '목표에 많이 못 미쳤어요. 무게를 조금 낮추고 반복수는 유지해요.',
  MAIN_RESTORE_REPS: () => '좋아요. 같은 무게로 원래 반복수를 다시 채워요.',
  MAIN_PAIN_HOLD: () => '불편감이 있었던 운동이라 무게를 올리지 않아요.',
  MAIN_EXCLUDED: () => '오늘 기록은 안전 문제로 다음 계산에 반영하지 않아요.',
  DOUBLE_TOP_INCREASE: () => '모든 세트에서 반복 범위 상단을 채웠어요. 다음엔 무게를 올리고 반복수를 다시 시작해요.',
  DOUBLE_HOLD_ADD_REPS: () => '같은 무게로 세트마다 1회씩 더 해봐요.',
  DOUBLE_BELOW_MIN_HOLD: () => '반복 범위 아래로 내려간 세트가 있어요. 같은 무게로 한 번 더 해요.',
  DOUBLE_BELOW_MIN_REDUCE: () => '두 번 연속 반복 범위에 못 미쳐 무게를 조금 낮춰요.',
  DOUBLE_PAIN_HOLD: () => '불편감이 있었던 운동이라 무게를 올리지 않아요.',
  DOUBLE_EXCLUDED: () => '오늘 기록은 다음 계산에 반영하지 않아요.',
};

export function fmtRest(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (!m) return `${s}초`;
  return s ? `${m}분 ${s}초` : `${m}분`;
}

export function explain(item: RationaleItem): string {
  const f = T[item.code];
  return f ? f(item.params ?? {}) : '';
}

export const LEVEL_KO: Record<EvidenceLevel, string> = {
  high: '근거 높음', moderate: '근거 중간', low: '근거 낮음', uncertain: '불확실', heuristic: '실무 기본값',
};

export function muscleKo(m: MuscleId | string): string {
  return MUSCLES[m as MuscleId]?.nameKo ?? GROUP_NAME_KO[m as MuscleGroup] ?? m;
}

/** Guard for any generated explanation: every number in the text must appear in the source params. */
export function numbersAreGrounded(text: string, params: Record<string, string | number>): boolean {
  const allowed = new Set(Object.values(params).flatMap((v) => String(v).match(/\d+(\.\d+)?/g) ?? []));
  const found = text.match(/\d+(\.\d+)?/g) ?? [];
  return found.every((n) => allowed.has(n));
}
