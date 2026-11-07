import type { SafetyType } from '../types';

export type SafetyAction = 'freeze_progression' | 'end_exercise' | 'end_session';

export interface SafetyOption {
  type: SafetyType;
  labelKo: string;
  action: SafetyAction;
}

export const SAFETY_OPTIONS: SafetyOption[] = [
  { type: 'pain_mild', labelKo: '가벼운 불편감', action: 'freeze_progression' },
  { type: 'sharp_pain', labelKo: '날카로운 통증', action: 'end_exercise' },
  { type: 'acute_injury', labelKo: '부상이 의심됨', action: 'end_exercise' },
  { type: 'dizziness', labelKo: '어지러움', action: 'end_session' },
  { type: 'chest_pain', labelKo: '가슴 통증', action: 'end_session' },
  { type: 'shortness_of_breath', labelKo: '비정상적인 호흡곤란', action: 'end_session' },
];

export const SAFETY_MESSAGE: Record<SafetyAction, string> = {
  freeze_progression:
    '통증이 있다면 중량을 무리하게 증가시키지 말고 운동을 중단하거나 전문가의 평가를 받으세요. 이 운동은 다음에 중량을 올리지 않아요.',
  end_exercise:
    '이 운동은 여기서 멈출게요. 통증이 계속되면 운동을 중단하고 전문가의 평가를 받으세요. 오늘 기록은 다음 중량 계산에 반영하지 않아요.',
  end_session:
    '지금은 운동을 멈추고 안정을 취하세요. 증상이 심하거나 계속되면 즉시 의료기관에 연락하거나 응급 도움을 요청하세요.',
};

export function actionFor(type: SafetyType): SafetyAction {
  return SAFETY_OPTIONS.find((o) => o.type === type)!.action;
}
