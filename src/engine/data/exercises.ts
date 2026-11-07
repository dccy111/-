import type { Exercise, MuscleContribution, MuscleId } from '../types';

const P = (muscle: MuscleId): MuscleContribution => ({ muscle, role: 'primary', contribution: 1 });
const S = (muscle: MuscleId): MuscleContribution => ({ muscle, role: 'secondary', contribution: 0.5 });

type Def = Omit<Exercise, 'repDurationSec' | 'setupSec' | 'perHand' | 'bodyweightLoaded' | 'incrementKg'> &
  Partial<Pick<Exercise, 'repDurationSec' | 'setupSec' | 'perHand' | 'bodyweightLoaded' | 'incrementKg'>>;

const INCREMENT: Record<Exercise['equipment'], number> = {
  barbell: 2.5, dumbbell: 2, machine: 5, cable: 2.5, bodyweight: 2.5,
};

function ex(d: Def): Exercise {
  const compound = d.mechanic === 'compound';
  return {
    repDurationSec: compound ? 4 : 3, // evidence: heuristic (time estimation)
    setupSec: compound ? 25 : 15,
    perHand: d.equipment === 'dumbbell',
    bodyweightLoaded: false,
    incrementKg: INCREMENT[d.equipment],
    ...d,
  };
}

/**
 * Exercise database. Order inside a pattern = default preference (deterministic selection).
 * ratioFrom values are rough starting points only (evidence: low) and are always labelled "추정".
 */
export const EXERCISES: Exercise[] = [
  // ---- Squat / knee dominant
  ex({ id: 'back_squat', nameKo: '바벨 스쿼트', nameEn: 'Squat', pattern: 'squat', mechanic: 'compound', equipment: 'barbell', oneRmApplicable: true, repMin: 3, repMax: 10, restSec: 180, difficulty: 2, fatigueCost: 1.3, muscles: [P('quads'), P('glutes'), S('hamstrings'), S('erectors')] }),
  ex({ id: 'front_squat', nameKo: '프론트 스쿼트', nameEn: 'Front Squat', pattern: 'squat', mechanic: 'compound', equipment: 'barbell', oneRmApplicable: true, repMin: 3, repMax: 8, restSec: 180, difficulty: 3, fatigueCost: 1.2, muscles: [P('quads'), S('glutes'), S('upper_back')], ratioFrom: { exerciseId: 'back_squat', ratio: 0.82 } }),
  ex({ id: 'hack_squat', nameKo: '핵 스쿼트', nameEn: 'Hack Squat', pattern: 'leg_press', mechanic: 'compound', equipment: 'machine', oneRmApplicable: true, repMin: 6, repMax: 12, restSec: 150, difficulty: 1, fatigueCost: 1.0, muscles: [P('quads'), S('glutes')] }),
  ex({ id: 'leg_press', nameKo: '레그 프레스', nameEn: 'Leg Press', pattern: 'leg_press', mechanic: 'compound', equipment: 'machine', oneRmApplicable: true, repMin: 8, repMax: 15, restSec: 150, difficulty: 1, fatigueCost: 0.9, muscles: [P('quads'), S('glutes')] }),
  ex({ id: 'bulgarian_split_squat', nameKo: '불가리안 스플릿 스쿼트', nameEn: 'Bulgarian Split Squat', pattern: 'lunge', mechanic: 'compound', equipment: 'dumbbell', oneRmApplicable: false, repMin: 8, repMax: 12, restSec: 120, difficulty: 2, fatigueCost: 0.9, muscles: [P('quads'), P('glutes')] }),
  ex({ id: 'walking_lunge', nameKo: '워킹 런지', nameEn: 'Walking Lunge', pattern: 'lunge', mechanic: 'compound', equipment: 'dumbbell', oneRmApplicable: false, repMin: 8, repMax: 14, restSec: 120, difficulty: 1, fatigueCost: 0.9, muscles: [P('quads'), P('glutes'), S('hamstrings')] }),
  // ---- Hinge
  ex({ id: 'deadlift', nameKo: '데드리프트', nameEn: 'Deadlift', pattern: 'hinge', mechanic: 'compound', equipment: 'barbell', oneRmApplicable: true, repMin: 2, repMax: 6, restSec: 210, difficulty: 2, fatigueCost: 1.5, muscles: [P('glutes'), P('hamstrings'), P('erectors'), S('quads'), S('upper_back'), S('lats')] }),
  ex({ id: 'romanian_deadlift', nameKo: '루마니안 데드리프트', nameEn: 'Romanian Deadlift', pattern: 'hinge', mechanic: 'compound', equipment: 'barbell', oneRmApplicable: true, repMin: 6, repMax: 10, restSec: 150, difficulty: 2, fatigueCost: 1.1, muscles: [P('hamstrings'), P('glutes'), S('erectors')], ratioFrom: { exerciseId: 'deadlift', ratio: 0.65 } }),
  ex({ id: 'hip_thrust', nameKo: '힙 스러스트', nameEn: 'Hip Thrust', pattern: 'hip_thrust', mechanic: 'compound', equipment: 'barbell', oneRmApplicable: true, repMin: 8, repMax: 12, restSec: 120, difficulty: 1, fatigueCost: 0.8, muscles: [P('glutes'), S('hamstrings')] }),
  ex({ id: 'back_extension', nameKo: '백 익스텐션', nameEn: 'Back Extension', pattern: 'back_extension', mechanic: 'isolation', equipment: 'bodyweight', oneRmApplicable: false, repMin: 10, repMax: 15, restSec: 90, difficulty: 1, fatigueCost: 0.5, muscles: [P('glutes'), P('erectors'), S('hamstrings')] }),
  // ---- Horizontal push
  ex({ id: 'bench_press', nameKo: '벤치 프레스', nameEn: 'Bench Press', pattern: 'horizontal_push', mechanic: 'compound', equipment: 'barbell', oneRmApplicable: true, repMin: 3, repMax: 10, restSec: 180, difficulty: 2, fatigueCost: 1.0, muscles: [P('chest'), S('triceps'), S('front_delt')] }),
  ex({ id: 'db_bench_press', nameKo: '덤벨 벤치 프레스', nameEn: 'DB Bench Press', pattern: 'horizontal_push', mechanic: 'compound', equipment: 'dumbbell', oneRmApplicable: true, repMin: 6, repMax: 12, restSec: 150, difficulty: 1, fatigueCost: 0.9, muscles: [P('chest'), S('triceps'), S('front_delt')], ratioFrom: { exerciseId: 'bench_press', ratio: 0.37 } }),
  ex({ id: 'machine_chest_press', nameKo: '머신 체스트 프레스', nameEn: 'Machine Chest Press', pattern: 'horizontal_push', mechanic: 'compound', equipment: 'machine', oneRmApplicable: true, repMin: 8, repMax: 12, restSec: 120, difficulty: 1, fatigueCost: 0.7, muscles: [P('chest'), S('triceps'), S('front_delt')] }),
  ex({ id: 'incline_db_press', nameKo: '인클라인 덤벨 프레스', nameEn: 'Incline DB Press', pattern: 'incline_push', mechanic: 'compound', equipment: 'dumbbell', oneRmApplicable: true, repMin: 6, repMax: 12, restSec: 150, difficulty: 1, fatigueCost: 0.9, muscles: [P('chest'), S('front_delt'), S('triceps')], ratioFrom: { exerciseId: 'bench_press', ratio: 0.32 } }),
  ex({ id: 'incline_bench_press', nameKo: '인클라인 벤치 프레스', nameEn: 'Incline Bench Press', pattern: 'incline_push', mechanic: 'compound', equipment: 'barbell', oneRmApplicable: true, repMin: 4, repMax: 10, restSec: 150, difficulty: 2, fatigueCost: 1.0, muscles: [P('chest'), S('front_delt'), S('triceps')], ratioFrom: { exerciseId: 'bench_press', ratio: 0.82 } }),
  ex({ id: 'dip', nameKo: '딥스', nameEn: 'Dip', pattern: 'incline_push', mechanic: 'compound', equipment: 'bodyweight', oneRmApplicable: true, bodyweightLoaded: true, repMin: 6, repMax: 12, restSec: 150, difficulty: 2, fatigueCost: 0.9, muscles: [P('chest'), P('triceps'), S('front_delt')] }),
  // ---- Vertical push
  ex({ id: 'overhead_press', nameKo: '오버헤드 프레스', nameEn: 'Overhead Press', pattern: 'vertical_push', mechanic: 'compound', equipment: 'barbell', oneRmApplicable: true, repMin: 3, repMax: 10, restSec: 180, difficulty: 2, fatigueCost: 0.9, muscles: [P('front_delt'), S('side_delt'), S('triceps')], ratioFrom: { exerciseId: 'bench_press', ratio: 0.62 } }),
  ex({ id: 'seated_db_press', nameKo: '시티드 덤벨 프레스', nameEn: 'Seated DB Press', pattern: 'vertical_push', mechanic: 'compound', equipment: 'dumbbell', oneRmApplicable: true, repMin: 6, repMax: 12, restSec: 120, difficulty: 1, fatigueCost: 0.8, muscles: [P('front_delt'), S('side_delt'), S('triceps')], ratioFrom: { exerciseId: 'overhead_press', ratio: 0.38 } }),
  // ---- Horizontal pull
  ex({ id: 'barbell_row', nameKo: '바벨 로우', nameEn: 'Barbell Row', pattern: 'horizontal_pull', mechanic: 'compound', equipment: 'barbell', oneRmApplicable: true, repMin: 5, repMax: 10, restSec: 150, difficulty: 2, fatigueCost: 1.0, muscles: [P('upper_back'), P('lats'), S('rear_delt'), S('biceps'), S('erectors')], ratioFrom: { exerciseId: 'bench_press', ratio: 0.75 } }),
  ex({ id: 'chest_supported_row', nameKo: '체스트 서포티드 로우', nameEn: 'Chest-Supported Row', pattern: 'horizontal_pull', mechanic: 'compound', equipment: 'machine', oneRmApplicable: true, repMin: 8, repMax: 12, restSec: 120, difficulty: 1, fatigueCost: 0.7, muscles: [P('upper_back'), P('lats'), S('rear_delt'), S('biceps')] }),
  ex({ id: 'seated_cable_row', nameKo: '시티드 케이블 로우', nameEn: 'Seated Cable Row', pattern: 'horizontal_pull', mechanic: 'compound', equipment: 'cable', oneRmApplicable: true, repMin: 8, repMax: 12, restSec: 120, difficulty: 1, fatigueCost: 0.7, muscles: [P('upper_back'), P('lats'), S('biceps'), S('rear_delt')] }),
  ex({ id: 'one_arm_db_row', nameKo: '원암 덤벨 로우', nameEn: 'One-Arm DB Row', pattern: 'horizontal_pull', mechanic: 'compound', equipment: 'dumbbell', oneRmApplicable: true, repMin: 8, repMax: 12, restSec: 90, difficulty: 1, fatigueCost: 0.7, muscles: [P('lats'), P('upper_back'), S('biceps'), S('rear_delt')] }),
  // ---- Vertical pull
  ex({ id: 'pull_up', nameKo: '풀업', nameEn: 'Pull-up', pattern: 'vertical_pull', mechanic: 'compound', equipment: 'bodyweight', oneRmApplicable: true, bodyweightLoaded: true, repMin: 5, repMax: 10, restSec: 150, difficulty: 2, fatigueCost: 0.9, muscles: [P('lats'), S('upper_back'), S('biceps')] }),
  ex({ id: 'lat_pulldown', nameKo: '랫 풀다운', nameEn: 'Lat Pulldown', pattern: 'vertical_pull', mechanic: 'compound', equipment: 'cable', oneRmApplicable: true, repMin: 8, repMax: 12, restSec: 120, difficulty: 1, fatigueCost: 0.7, muscles: [P('lats'), S('upper_back'), S('biceps')] }),
  // ---- Legs isolation
  ex({ id: 'leg_extension', nameKo: '레그 익스텐션', nameEn: 'Leg Extension', pattern: 'knee_extension', mechanic: 'isolation', equipment: 'machine', oneRmApplicable: false, repMin: 10, repMax: 15, restSec: 90, difficulty: 1, fatigueCost: 0.4, muscles: [P('quads')] }),
  ex({ id: 'lying_leg_curl', nameKo: '라잉 레그 컬', nameEn: 'Lying Leg Curl', pattern: 'knee_flexion', mechanic: 'isolation', equipment: 'machine', oneRmApplicable: false, repMin: 8, repMax: 15, restSec: 90, difficulty: 1, fatigueCost: 0.4, muscles: [P('hamstrings')] }),
  ex({ id: 'seated_leg_curl', nameKo: '시티드 레그 컬', nameEn: 'Seated Leg Curl', pattern: 'knee_flexion', mechanic: 'isolation', equipment: 'machine', oneRmApplicable: false, repMin: 8, repMax: 15, restSec: 90, difficulty: 1, fatigueCost: 0.4, muscles: [P('hamstrings')] }),
  ex({ id: 'standing_calf_raise', nameKo: '스탠딩 카프 레이즈', nameEn: 'Standing Calf Raise', pattern: 'calf_raise', mechanic: 'isolation', equipment: 'machine', oneRmApplicable: false, repMin: 8, repMax: 15, restSec: 75, difficulty: 1, fatigueCost: 0.3, muscles: [P('calves')] }),
  ex({ id: 'seated_calf_raise', nameKo: '시티드 카프 레이즈', nameEn: 'Seated Calf Raise', pattern: 'calf_raise', mechanic: 'isolation', equipment: 'machine', oneRmApplicable: false, repMin: 10, repMax: 20, restSec: 75, difficulty: 1, fatigueCost: 0.3, muscles: [P('calves')] }),
  // ---- Chest / shoulder isolation
  ex({ id: 'cable_fly', nameKo: '케이블 플라이', nameEn: 'Cable Fly', pattern: 'chest_fly', mechanic: 'isolation', equipment: 'cable', oneRmApplicable: false, repMin: 10, repMax: 15, restSec: 90, difficulty: 1, fatigueCost: 0.4, muscles: [P('chest'), S('front_delt')] }),
  ex({ id: 'pec_deck', nameKo: '펙덱 플라이', nameEn: 'Pec Deck', pattern: 'chest_fly', mechanic: 'isolation', equipment: 'machine', oneRmApplicable: false, repMin: 10, repMax: 15, restSec: 90, difficulty: 1, fatigueCost: 0.4, muscles: [P('chest')] }),
  ex({ id: 'lateral_raise', nameKo: '사이드 레터럴 레이즈', nameEn: 'Lateral Raise', pattern: 'lateral_raise', mechanic: 'isolation', equipment: 'dumbbell', oneRmApplicable: false, repMin: 10, repMax: 20, restSec: 75, difficulty: 1, fatigueCost: 0.3, muscles: [P('side_delt')] }),
  ex({ id: 'cable_lateral_raise', nameKo: '케이블 레터럴 레이즈', nameEn: 'Cable Lateral Raise', pattern: 'lateral_raise', mechanic: 'isolation', equipment: 'cable', oneRmApplicable: false, repMin: 10, repMax: 20, restSec: 75, difficulty: 1, fatigueCost: 0.3, muscles: [P('side_delt')] }),
  ex({ id: 'rear_delt_fly', nameKo: '리어 델트 플라이', nameEn: 'Rear Delt Fly', pattern: 'rear_delt', mechanic: 'isolation', equipment: 'machine', oneRmApplicable: false, repMin: 10, repMax: 20, restSec: 75, difficulty: 1, fatigueCost: 0.3, muscles: [P('rear_delt'), S('upper_back')] }),
  ex({ id: 'face_pull', nameKo: '페이스 풀', nameEn: 'Face Pull', pattern: 'rear_delt', mechanic: 'isolation', equipment: 'cable', oneRmApplicable: false, repMin: 12, repMax: 20, restSec: 75, difficulty: 1, fatigueCost: 0.3, muscles: [P('rear_delt'), S('upper_back')] }),
  // ---- Arms
  ex({ id: 'ez_bar_curl', nameKo: 'EZ바 컬', nameEn: 'EZ Bar Curl', pattern: 'elbow_flexion', mechanic: 'isolation', equipment: 'barbell', oneRmApplicable: false, repMin: 8, repMax: 15, restSec: 75, difficulty: 1, fatigueCost: 0.3, incrementKg: 2.5, muscles: [P('biceps')] }),
  ex({ id: 'db_curl', nameKo: '덤벨 컬', nameEn: 'DB Curl', pattern: 'elbow_flexion', mechanic: 'isolation', equipment: 'dumbbell', oneRmApplicable: false, repMin: 8, repMax: 15, restSec: 75, difficulty: 1, fatigueCost: 0.3, muscles: [P('biceps')] }),
  ex({ id: 'hammer_curl', nameKo: '해머 컬', nameEn: 'Hammer Curl', pattern: 'elbow_flexion', mechanic: 'isolation', equipment: 'dumbbell', oneRmApplicable: false, repMin: 8, repMax: 15, restSec: 75, difficulty: 1, fatigueCost: 0.3, muscles: [P('biceps')] }),
  ex({ id: 'triceps_pushdown', nameKo: '트라이셉스 푸시다운', nameEn: 'Triceps Pushdown', pattern: 'elbow_extension', mechanic: 'isolation', equipment: 'cable', oneRmApplicable: false, repMin: 10, repMax: 15, restSec: 75, difficulty: 1, fatigueCost: 0.3, muscles: [P('triceps')] }),
  ex({ id: 'overhead_triceps_ext', nameKo: '오버헤드 트라이셉스 익스텐션', nameEn: 'Overhead Triceps Extension', pattern: 'elbow_extension', mechanic: 'isolation', equipment: 'cable', oneRmApplicable: false, repMin: 10, repMax: 15, restSec: 75, difficulty: 1, fatigueCost: 0.3, muscles: [P('triceps')] }),
  ex({ id: 'skull_crusher', nameKo: '스컬 크러셔', nameEn: 'Skull Crusher', pattern: 'elbow_extension', mechanic: 'isolation', equipment: 'barbell', oneRmApplicable: false, repMin: 8, repMax: 12, restSec: 90, difficulty: 2, fatigueCost: 0.4, muscles: [P('triceps')] }),
  // ---- Core
  ex({ id: 'cable_crunch', nameKo: '케이블 크런치', nameEn: 'Cable Crunch', pattern: 'core', mechanic: 'isolation', equipment: 'cable', oneRmApplicable: false, repMin: 10, repMax: 15, restSec: 60, difficulty: 1, fatigueCost: 0.2, muscles: [P('abs')] }),
  ex({ id: 'hanging_leg_raise', nameKo: '행잉 레그 레이즈', nameEn: 'Hanging Leg Raise', pattern: 'core', mechanic: 'isolation', equipment: 'bodyweight', oneRmApplicable: false, repMin: 8, repMax: 15, restSec: 60, difficulty: 2, fatigueCost: 0.3, muscles: [P('abs')] }),
];

export const EXERCISE_BY_ID: Record<string, Exercise> = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));

export function getExercise(id: string): Exercise {
  const e = EXERCISE_BY_ID[id];
  if (!e) throw new Error(`Unknown exercise: ${id}`);
  return e;
}

/** Lifts shown on the onboarding 1RM screen. */
export const ONBOARDING_LIFTS = ['back_squat', 'bench_press', 'deadlift', 'overhead_press'];
export const OPTIONAL_1RM_LIFTS = ['barbell_row', 'front_squat', 'romanian_deadlift', 'pull_up', 'dip', 'incline_bench_press'];
