import type { FocusRegion, MuscleGroup, MuscleId } from '../types';

export const MUSCLES: Record<MuscleId, { nameKo: string; group: MuscleGroup }> = {
  chest: { nameKo: '가슴', group: 'chest' },
  lats: { nameKo: '광배', group: 'back' },
  upper_back: { nameKo: '등 상부', group: 'back' },
  front_delt: { nameKo: '전면 어깨', group: 'shoulders' },
  side_delt: { nameKo: '측면 어깨', group: 'shoulders' },
  rear_delt: { nameKo: '후면 어깨', group: 'shoulders' },
  triceps: { nameKo: '삼두', group: 'triceps' },
  biceps: { nameKo: '이두', group: 'biceps' },
  quads: { nameKo: '대퇴사두', group: 'quads' },
  hamstrings: { nameKo: '햄스트링', group: 'posterior' },
  glutes: { nameKo: '둔근', group: 'posterior' },
  calves: { nameKo: '종아리', group: 'calves' },
  abs: { nameKo: '복근', group: 'core' },
  erectors: { nameKo: '척추기립근', group: 'posterior' },
};

export const GROUP_NAME_KO: Record<MuscleGroup, string> = {
  chest: '가슴', back: '등', shoulders: '어깨', biceps: '이두', triceps: '삼두',
  quads: '대퇴사두', posterior: '둔근·햄스트링', calves: '종아리', core: '코어',
};

/**
 * Muscles that get an explicit weekly volume target, with a priority multiplier.
 * Small muscles that already receive indirect work from compounds get < 1.0.
 * evidence: low (programming heuristic) — front delts / erectors are tracked but untargeted.
 */
export const VOLUME_PRIORITY: Partial<Record<MuscleId, number>> = {
  chest: 1, lats: 1, upper_back: 0.8, quads: 1, hamstrings: 0.9, glutes: 0.8,
  side_delt: 0.8, rear_delt: 0.6, triceps: 0.7, biceps: 0.7, calves: 0.6, abs: 0.5,
};

/** Volume display order in the UI. */
export const DISPLAY_MUSCLES: MuscleId[] = [
  'chest', 'lats', 'upper_back', 'side_delt', 'rear_delt', 'triceps', 'biceps',
  'quads', 'hamstrings', 'glutes', 'calves', 'abs',
];

export const FOCUS_REGIONS: { id: FocusRegion; nameKo: string; groups: MuscleGroup[] }[] = [
  { id: 'chest', nameKo: '가슴', groups: ['chest'] },
  { id: 'back', nameKo: '등', groups: ['back'] },
  { id: 'shoulders', nameKo: '어깨', groups: ['shoulders'] },
  { id: 'arms', nameKo: '팔', groups: ['biceps', 'triceps'] },
  { id: 'legs', nameKo: '하체', groups: ['quads', 'posterior'] },
  { id: 'glutes_hams', nameKo: '둔근·햄스트링', groups: ['posterior'] },
  { id: 'calves', nameKo: '종아리', groups: ['calves'] },
  { id: 'core', nameKo: '코어', groups: ['core'] },
];
