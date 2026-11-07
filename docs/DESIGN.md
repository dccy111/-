# 근거 기반 웨이트 트레이닝 앱 — 설계 문서 v0.3 (검토용 초안)

> v0.3: 온보딩은 추천 분할로 자동 진행, 프로그램 탭에서 추천+직접 구성을 한 화면에서 변경, 부위 집중 day 추가. 시안: `docs/mockup/split.png`

> 이 문서는 **코드 작성 전 설계안**이다. 모든 수치는 "출발점(default)"이며, 엔진 내부에서
> `evidence_level`과 함께 관리되어 조정 가능하다. 확정 전까지 수정을 전제로 한다.

---

## 0. 설계 원칙 요약

| 원칙 | 설계 반영 |
|---|---|
| 처방 로직 ↔ 소프트웨어 분리 | `engine/`은 React·DB를 모르는 **순수 TypeScript 함수**. 입력 → 출력이 결정적(deterministic)이라 단위 테스트 가능 |
| 근거 기반 + 유연성 | 수치는 코드에 하드코딩하지 않고 `EvidenceRule`(범위 + 근거수준)에서 읽는다 |
| AI는 숫자를 만들지 않는다 | 엔진이 숫자와 `rationale code`를 만들고, AI(2차)는 그 코드를 문장으로만 바꾼다 |
| 루프 | Program → Execute → Record → Adapt → Program |
| 최소 입력 | 첫 프로그램까지 탭 4~5번. 운동 중에는 버튼 1번/세트 |

---

## 1. 앱 전체 구조

```
┌──────────────────────────── UI (React, 모바일 우선 PWA) ────────────────────────────┐
│ Onboarding · Today · Workout Player · Summary · Program · Progress · Settings       │
└───────────────▲──────────────────────────────────────────────────────┬──────────────┘
                │ view model                                            │ user actions
┌───────────────┴───────────── Application Layer (use-cases) ──────────▼──────────────┐
│ createProgram() · getTodayWorkout() · logSet() · finishSession() · getDashboard()  │
└───────▲───────────────────────────────▲─────────────────────────────────▲──────────┘
        │                               │                                 │
┌───────┴────────── Training Engine (순수 함수, 테스트 대상) ───────────────┴──────────┐
│ ① Prescription Engine   목표·경력·빈도·시간 → Program                              │
│ ② Load Engine           1RM / e1RM / 단위 변환 / 원판 반올림                        │
│ ③ Adjustment Engine     수행기록 → 다음 처방 (progression, rest, readiness, deload) │
│ ④ Analytics             e1RM 추이, PR, 볼륨, 근육별 주간 세트                        │
│ ⑤ Safety                통증/위험 신호 → 진행 차단                                  │
│ ⑥ Rationale             처방 이유를 코드로 출력 (설명 레이어의 입력)               │
│        ▲ 읽기 전용                                                                  │
│ Evidence Base (규칙·범위·근거수준·출처)   Exercise DB (근육 기여도·패턴·장비)        │
└─────────────────────────────────────────────────────────────────────────────────────┘
        │
┌───────┴────────── Persistence (Repository 인터페이스) ─────────────────────────────┐
│ MVP: IndexedDB(Dexie) 로컬 우선, 즉시 자동저장, 오프라인 동작                        │
│ 2차: Supabase(Postgres + Auth + RLS) 동기화 — 스키마는 처음부터 Postgres 기준       │
└─────────────────────────────────────────────────────────────────────────────────────┘
        │ (2차)
   AI Explanation Layer — rationale code + 숫자 → 짧은 설명. 숫자 생성 금지(검증기 포함)
```

### 폴더 구조(안)

```
src/
  engine/                 ← 순수 로직. UI/DB import 금지 (lint 규칙으로 강제)
    evidence/   rules.ts  sources.ts
    data/       exercises.ts  muscles.ts  splitTemplates.ts
    prescription/
      goalProfile.ts   split.ts   volumeTargets.ts   selection.ts
      prescribe.ts     warmup.ts  timeBudget.ts      generateProgram.ts
    load/       e1rm.ts  rounding.ts  units.ts  startingLoad.ts
    adjust/     classify.ts  mainLift.ts  doubleProgression.ts
                rest.ts  readiness.ts  deload.ts
    analytics/  prs.ts  weeklyVolume.ts  trends.ts
    safety/     painFlags.ts
    explain/    rationaleCodes.ts  templates.ko.ts
    __tests__/
  app/          use-cases (엔진 + repository 연결)
  db/           repository 인터페이스, dexie 구현, (supabase 구현)
  features/     onboarding/ today/ player/ summary/ program/ progress/ settings/
  ui/           공통 컴포넌트, 디자인 토큰
```

---

## 2. 핵심 사용자 Flow

### 2-1. 최초 실행 (목표: 30~60초)

```
[1] 목표 선택 (1탭)       💪근력 / 🏋️근비대 / ⚡근력+근비대 / 🔥감량+근육유지 / 🏃파워
[2] 주 몇 회 (1탭)        3 / 4 / 5 / 6
[3] 1회 운동 시간 (1탭)   30 / 45 / 60 / 90분
[4] 1RM 입력 (선택, 건너뛰기 가능)
    (분할은 묻지 않음: 추천 분할로 자동 결정 → 완료 화면에 표시, 프로그램 탭에서 변경)
      Squat [   ] kg   Bench [   ] kg   Deadlift [   ] kg   OHP [   ] kg  ...
      "모르면 비워두세요. 첫 운동에서 자동으로 맞춰집니다."
      (선택) "3~5회 가능한 무게 × 횟수"로도 입력 가능 → e1RM 계산
[5] "프로그램을 만들었어요" — 목표·횟수·시간 + 주간 분할 7칸 + 이유 1~2문장
    + "분할은 프로그램 탭에서 언제든 바꿀 수 있어요" → [오늘 운동 보기]
```

### 2-2. 일상 루프

```
앱 열기 → Today: 오늘 운동 카드 (3초 안에 보임)
  → [운동 시작] → 컨디션 1탭 (😄🙂😐😫, 건너뛰기 가능)
  → Workout Player: 세트 완료 → "몇 개 더 할 수 있었나요?" [0][1][2][3+] → 휴식 타이머 → 다음 세트
  → 운동 종료 → Summary: 볼륨 · PR · "다음 목표: Bench 85kg × 5 × 4"
  → (자동) Adjustment Engine이 다음 처방 계산·저장
  → 다음날 Today에 이미 조정된 처방이 표시
```

- **일정 모드는 두 가지**: `순서대로(rotation)` / `요일 고정(fixed_weekdays)`. 추천 분할 선택 시 기본은 rotation,
  직접 구성에서는 요일 고정이 기본. rotation에서는 하루 빠져도 다음 운동이 그대로
  "오늘 운동"이 되어 계획이 깨지지 않는다. (요일 지정은 2차)

### 2-3. 1RM 없는 운동의 첫 세션 (Calibration)

```
처방: Incline DB Press 3 × 8–12 · 목표 "2~3개 남기기"
권장 시작 무게: 24kg (Bench 기반 추정, 정확도 낮음 표시)  ← 관련 리프트가 있을 때만
1세트: 사용자가 무게 확인/수정 → 10회 → "몇 개 더?" [2]
  → 즉시 e1RM 계산 → 2세트 권장 무게 갱신 (세션 내 자기조절)
세션 종료 → 해당 운동 e1RM 저장 ("추정 1RM" 라벨)
```

---

## 3. Database Schema

Postgres 기준(Supabase 이전 대비). 로컬(Dexie)도 동일한 테이블/필드 구조를 사용.
**모든 무게는 kg(numeric)로 저장**, 표시 단위(kg/lb)와 반올림은 표시 시점에만 적용.

### 3-1. 참조 데이터 (앱 내장, 버전 관리)

```sql
muscles(
  id text PK,                -- 'chest','lats','quads','hamstrings','glutes','front_delt',
  name_ko text,              -- 'side_delt','rear_delt','triceps','biceps','traps','calves','abs'...
  region text                -- 'upper'|'lower'|'core'
)

exercises(
  id text PK,                -- 'bench_press'
  name_ko text, name_en text,
  movement_pattern text,     -- 'squat'|'hinge'|'horizontal_push'|'vertical_push'|
                             -- 'horizontal_pull'|'vertical_pull'|'lunge'|'isolation_*'|'jump'
  mechanic text,             -- 'compound'|'isolation'
  equipment text,            -- 'barbell'|'dumbbell'|'machine'|'cable'|'bodyweight'
  is_1rm_applicable bool,    -- 1RM/e1RM 기반 처방이 의미 있는지 (레그익스텐션 등은 false 권장)
  is_bodyweight_loaded bool, -- pull-up/dip: 유효부하 = 체중 + 추가중량
  default_rep_min int, default_rep_max int,
  default_rest_sec int,
  load_increment_kg numeric, -- barbell 2.5, dumbbell 2(쌍), machine 2.5~5
  rep_duration_sec numeric,  -- 시간 계산용 (compound 4, isolation 3)
  setup_sec int,             -- 세트 준비 시간
  difficulty int,            -- 1~3 (기술 요구도)
  fatigue_cost numeric,      -- 0.5~1.5 (시스템 피로 상대값, 데드리프트↑) evidence: low
  engine_version text
)

exercise_muscles(
  exercise_id text FK, muscle_id text FK,
  role text,                 -- 'primary'|'secondary'
  contribution numeric,      -- primary 1.0 / secondary 0.5 (기본값, evidence: low~moderate)
  PRIMARY KEY (exercise_id, muscle_id)
)

evidence_sources(
  id text PK, citation text, year int, study_type text, -- 'position_stand'|'meta_analysis'|'RCT'|'expert_consensus'
  doi text, url text, verified bool                     -- 원문 확인 전 false
)

evidence_rules(
  id text PK,
  variable text,             -- 'strength_load','hypertrophy_weekly_sets','rest_compound_heavy',...
  recommendation text,       -- 사람이 읽는 설명
  value_min numeric, value_max numeric, unit text,
  evidence_level text,       -- 'high'|'moderate'|'low'|'uncertain'|'heuristic'
  source_ids text[],
  population text,           -- 'trained adults','untrained','older adults'...
  limitation text,
  engine_param_key text      -- 엔진이 읽는 키
)
```

### 3-2. 사용자 데이터

```sql
users(
  id uuid PK, display_name text,
  unit_pref text DEFAULT 'kg',       -- 'kg'|'lb'
  bodyweight_kg numeric NULL,        -- pull-up/dip 처방에 필요(선택)
  training_age text,                 -- 'novice'|'intermediate'|'advanced'
  created_at timestamptz
)

user_settings(
  user_id uuid PK FK,
  goal text,                         -- 'strength'|'hypertrophy'|'strength_hypertrophy'|'recomp'|'power'
  days_per_week int, session_minutes int,
  equipment text[],                  -- 기본 full gym
  plate_increment_kg numeric DEFAULT 2.5,   -- 마이크로플레이트 있으면 1.25
  rir_prompt text DEFAULT 'every_set',      -- 'every_set'|'last_set'
  updated_at timestamptz
)

user_exercises(                       -- 사용자별 운동 상태 (1RM, e1RM, 선호)
  user_id uuid, exercise_id text, PRIMARY KEY(user_id, exercise_id),
  tested_1rm_kg numeric NULL, tested_1rm_at date NULL,
  e1rm_kg numeric NULL, e1rm_source text,    -- 'tested'|'estimated'|'derived_ratio'
  e1rm_updated_at timestamptz,
  excluded bool DEFAULT false, favorite bool DEFAULT false
)

programs(
  id uuid PK, user_id uuid FK,
  status text,                       -- 'active'|'archived'
  goal text, split_type text,        -- 'full_body_3','upper_lower_4','ul_ppl_5','ppl_6',...,'custom'
  split_source text,                 -- 'recommended'|'alternative'|'custom' (사용자가 고른 방식)
  schedule_mode text,                -- 'rotation'|'fixed_weekdays'
  split_warnings jsonb,              -- 사용자가 경고를 무시하고 저장한 경우 기록
  inputs_snapshot jsonb,             -- 생성 당시 입력값 (재현성)
  weekly_volume_targets jsonb,       -- {chest: 12, quads: 10, ...}
  rationale jsonb,                   -- [{code, params}]
  engine_version text,
  block_week int DEFAULT 1,
  created_at timestamptz
)

program_days(
  id uuid PK, program_id uuid FK,
  seq int,                           -- rotation 순서
  weekday int NULL,                  -- fixed_weekdays 모드일 때 0(월)~6(일)
  day_type text,                     -- 'upper'|'lower'|'push'|'pull'|'legs'|'full'|'focus'
  focus_regions text[] NULL,         -- day_type='focus'일 때 1~3개: chest|back|shoulders|arms|legs|glutes_hams|calves|core
  label text,                        -- 'Upper A'
  est_minutes int
)

program_exercises(                    -- "템플릿 슬롯" (무엇을, 어떤 역할로)
  id uuid PK, program_day_id uuid FK,
  exercise_id text FK, order_idx int,
  role text,                         -- 'main'|'secondary'|'isolation'
  superset_group text NULL,
  sets int, rep_min int, rep_max int,
  target_rir_min int, target_rir_max int,
  rest_sec int,
  progression_model text,            -- 'load_rir' (메인) | 'double' (보조)
  min_sets int                       -- 시간 압축 시 지켜야 할 최소 세트
)

progression_state(                    -- "다음에 무엇을 할지" — Adjustment Engine의 출력
  user_id uuid, program_exercise_id uuid, PRIMARY KEY(user_id, program_exercise_id),
  next_load_kg numeric NULL,         -- NULL이면 calibration 필요
  next_reps int, next_sets int,
  next_rest_sec int,
  stall_count int DEFAULT 0,         -- 연속 비진행 세션 수
  fail_count int DEFAULT 0,
  last_outcome text,                 -- 'exceed'|'success'|'grind'|'partial'|'fail'
  updated_at timestamptz
)

workout_sessions(
  id uuid PK, user_id uuid FK, program_day_id uuid FK,
  date date, started_at timestamptz, ended_at timestamptz,
  readiness int NULL,                -- 4 좋음 3 보통 2 별로 1 매우피곤
  is_deload bool DEFAULT false,
  status text,                       -- 'in_progress'|'completed'|'abandoned'
  safety_flag text NULL, notes text
)

workout_sets(
  id uuid PK, session_id uuid FK, exercise_id text, program_exercise_id uuid NULL,
  set_idx int, set_type text,        -- 'warmup'|'working'
  target_load_kg numeric, target_reps int,
  load_kg numeric, reps int,
  rir int NULL,                      -- 0,1,2,3 (3 = "3+")
  rest_sec_actual int NULL,
  completed_at timestamptz, notes text
)

exercise_session_summary(             -- 세션 종료 시 계산해 저장 (조회 성능 + 그래프)
  session_id uuid, exercise_id text, PRIMARY KEY(session_id, exercise_id),
  best_set_e1rm_kg numeric, total_volume_kg numeric, total_reps int,
  hard_sets int, completion_ratio numeric, avg_rir numeric, outcome text
)

personal_records(
  id uuid PK, user_id uuid, exercise_id text,
  type text,                         -- 'max_load'|'reps_at_load'|'e1rm'|'session_volume'
  value numeric, load_kg numeric, reps int,
  set_id uuid, achieved_at timestamptz
)

adjustment_log(                       -- 모든 자동 조정의 이유 기록 (설명·디버깅·테스트)
  id uuid PK, user_id uuid, program_exercise_id uuid, session_id uuid,
  rule_code text,                    -- 'MAIN_EXCEED_INCREASE','DOUBLE_TOP_OF_RANGE',...
  before jsonb, after jsonb, created_at timestamptz
)

safety_events(
  id uuid PK, user_id uuid, session_id uuid NULL, exercise_id text NULL,
  type text,                         -- 'pain_mild'|'sharp_pain'|'acute_injury'|'dizziness'|
                                     -- 'chest_pain'|'shortness_of_breath'
  created_at timestamptz
)
```

> 요청서의 `Progress` 테이블은 역할을 나눠 `progression_state`(다음 처방)와
> `exercise_session_summary`(수행 결과 집계)로 분리했다.

---

## 4. 프로그램 생성 알고리즘 (Prescription Engine)

### 4-1. 변수 우선순위 (충돌 시 위가 이긴다)

| 순위 | 변수 | 성격 | 역할 |
|---|---|---|---|
| 1 | Safety (통증/위험 신호) | **Hard constraint** | 해당 운동 진행 중단·증량 금지 |
| 2 | Session duration | **Hard constraint** | 예상 시간 ≤ 선택 시간 (절대 초과 불가) |
| 3 | Goal | 방향 결정 | 강도 구간, 볼륨 목표, 휴식, 진행 모델의 가중치 |
| 4 | Training age | 크기 조절 | 볼륨 목표, 진행 속도, RIR 목표, 운동 난이도 상한 |
| 5 | Frequency | 배분 | split 선택, 근육별 주간 빈도, 세션당 볼륨 |
| 6 | Exercise type (role) | 슬롯 처방 | main / secondary / isolation 별 부하·반복·휴식 |
| 7 | Load reference | 숫자화 | tested 1RM > 최근 e1RM > 관련 리프트 비율 > 첫 세트 자율 선택 |
| 8 | Previous performance | 조정 | 다음 세션 중량·반복·휴식 |
| 9 | Fatigue (readiness) | 단기 조정 | 당일 소폭 조정 (과반응 금지, 추세 우선) |
| 10 | Progression history | 장기 조정 | 정체 감지 → deload 제안, 볼륨 조정 |

**Weekly volume**은 3·4·5가 함께 만드는 "목표값"이고, 2(시간)에 의해 상한이 깎인다.
깎인 경우 사용자에게 "시간 제약으로 일부 근육 볼륨이 출발점보다 낮습니다"라고 알린다.

### 4-2. 파이프라인

```
generateProgram(input) =
  goalProfile   = buildGoalProfile(goal)                       // STEP 1
  ageMod        = trainingAgeModifiers(trainingAge)            // STEP 2
  capacity      = estimateWeeklyCapacity(days, minutes)        // STEP 3
  split         = chooseSplit(days, minutes, goalProfile, ageMod, capacity)   // STEP 4
  volTargets    = weeklyVolumeTargets(goalProfile, ageMod, capacity)          // STEP 5
  days          = split.days.map(d => selectExercises(d, user, volTargets))   // STEP 6
  days          = days.map(d => prescribeSlots(d, goalProfile, ageMod, loadRefs)) // STEP 7
  days          = days.map(d => fitToTimeBudget(d, minutes))   // STEP 8 (hard)
  volumeReport  = computeWeeklyVolume(days)                    // STEP 9 검증
  days          = rebalance(days, volTargets, volumeReport)    // 부족/과다 근육 보정 후 8 재실행
  rationale     = collectRationaleCodes(...)
  return Program
```

#### STEP 1 — Goal Profile (if/else 대신 가중치 벡터)

목표를 4개 성분의 가중치로 표현한다. 모든 슬롯 처방은 **목표별 처방 구간의 가중 혼합**으로 계산된다.

| 목표 | Strength | Hypertrophy | Power | Maintain(감량) |
|---|---|---|---|---|
| 근력 | 0.8 | 0.2 | 0 | 0 |
| 근비대 | 0.2 | 0.8 | 0 | 0 |
| 근력+근비대 | 0.5 | 0.5 | 0 | 0 |
| 감량+근육유지 | 0.3 | 0.3 | 0 | 0.4 |
| 운동능력/파워 | 0.4 | 0.1 | 0.5 | 0 |

각 성분은 role별로 "구간"을 가진다 (evidence_rules에서 로드):

| 성분 × role | reps(+RIR) 기준 | 세트 | 휴식 | 비고 |
|---|---|---|---|---|
| Strength · main | 3–6 reps, RIR 1–3 (≈80–90%) | 3–5 | 3–5분 | 높은 부하가 최대근력에 유리 (high) |
| Hypertrophy · main | 6–10 reps, RIR 1–3 (≈70–80%) | 3–4 | 2–3분 | 다양한 부하에서 근비대 가능, 볼륨이 핵심 (high/moderate) |
| Power · main | 2–5 reps, RIR 3–5, 빠른 concentric (≈50–75%) | 3–5 | 2–4분 | 실패 회피 |
| Maintain · main | 4–8 reps, RIR 2–3 | 2–3 | 2–3분 | **강도 유지, 볼륨 축소**가 유지의 핵심 (moderate) |
| * · secondary | 6–10 reps, RIR 1–3 | 2–4 | 2–3분 | |
| * · isolation | 8–20 reps, RIR 0–3 | 2–4 | 60–120초 | 1RM 대신 RIR 기반 |

예: 근력+근비대 main = 0.5×(3–6) ⊕ 0.5×(6–10) → **4–6 reps 중심, 기본 5 reps**, 세트 4, 휴식 3분.
혼합 규칙: 범위의 중앙값을 가중 평균 → 가장 가까운 정수, 범위 폭은 두 범위의 교집합(없으면 가중 중앙 ± 1).

**근력+근비대에서는 같은 날 안에서 role로 블록을 섞는 방식**(main=strength 쪽, secondary/isolation=hypertrophy 쪽)을
기본으로 하고, 주 2회 이상 나오는 리프트는 heavy day / volume day로 나누는 DUP 변형을 적용한다
(예: Bench 월 4×5, 목 3×8). 증거 수준: 주기화 방식 간 차이는 크지 않음(moderate) → 단순한 쪽을 선택.

#### STEP 2 — Training age modifiers

| 항목 | Novice | Intermediate | Advanced | 근거수준 |
|---|---|---|---|---|
| 주간 볼륨 출발점(근육당, 근비대 1.0 기준) | 8–10 | 10–14 | 12–18 | moderate (용량-반응, 개인차 큼) |
| 목표 RIR 보정 | +1 (실패에서 멀리) | 0 | 0 (보조운동 RIR 0 허용) | low~moderate |
| RIR 자가보고 신뢰도 가중치 | 0.5 | 0.8 | 1.0 | moderate (경험↑ 정확도↑) |
| 진행 주기 | 세션 단위 | 세션~주 단위 | 주 단위/파동 | heuristic |
| 기본 증량폭(바벨 하체/상체) | 5 / 2.5kg | 2.5 / 2.5kg | 2.5 / 1.25kg | heuristic (ACSM 2–10% 원칙 범위 내) |
| 운동 난이도 상한 | 2 | 3 | 3 | heuristic |

#### STEP 3 — 주간 처리 가능 용량

```
세션당 작업 가능 시간 = minutes − 일반 워밍업(5분)
평균 세트 비용(분) ≈ goal별 평균 (작업시간 + 휴식) — 예: 근력+근비대 ≈ 2.8분/세트
주간 처리 가능 하드세트 ≈ days × (작업 가능 시간 / 평균 세트 비용)
```
→ 볼륨 목표를 정할 때 "원하는 양"과 "가능한 양" 중 작은 쪽을 사용하기 위한 값.

#### STEP 4 — Split 선택 (후보 점수화)

후보: `FB3`, `FB3+UL`(3일 시 대안), `UL4`, `FB4`, `UL_PPL5`, `UL4+FB`, `PPL6`, `UL6`

```
score(split) =
   w1 · musclefreq_score      // 각 근육 주 2회 이상 자극 비율 (moderate: 볼륨 분배 수단)
 + w2 · session_fit_score     // 하루 필요한 세트 수가 세션 시간에 들어가는가
 + w3 · main_lift_practice    // strength 가중치↑ → 메인 리프트 주 2회 이상 가산
 + w4 · recovery_score        // 같은 근육 연속일 배치, fatigue_cost 누적 감점
 + w5 · simplicity_score      // novice일수록 Full body/UL 가산
선택 = argmax(score), 동점 시 단순한 split
```
기본 결과 예시: 3일→FB3, 4일→UL4, 5일 60분→UL+PPL, 5일 30분→FB/UL 혼합, 6일 60분+→PPL×2, 6일 30분→UL×3.
**같은 입력이면 항상 같은 결과**(랜덤 없음).

#### STEP 4-b — 사용자 분할 선택·직접 구성 (v0.2)

`chooseSplit()`은 1개가 아니라 **점수순 후보 목록**을 반환한다: `[{split, score, checks[], warnings[]}]`.
- UI(프로그램 탭 › 분할 변경)는 **추천과 직접 구성을 한 화면**에 둔다: 상단 프리셋 칩(★추천 / 대안들) → 아래 요일 편집기에
  채워짐. 요일 하나라도 바꾸면 자동으로 custom이 되고 "추천에서 N곳 수정됨 · 추천으로 되돌리기"를 표시한다. 각 후보에 판정 칩을 붙인다
  (✓ 모든 근육 주 2회 / ✓ 60분 안에 들어감 / ! 하체 주 1회인 주가 생김).
- 사용자가 무엇을 고르든 이후 파이프라인(STEP 5~9)은 동일하다. 분할은 **볼륨을 나누는 틀**일 뿐,
  주간 볼륨 목표·시간 제약·진행 로직은 그대로 적용된다.

**직접 구성(custom)** — 요일마다 day type을 지정: 분할(Upper/Lower/Push/Pull/Legs/전신) · **부위 집중**(가슴/등/어깨/팔/하체/둔근·햄스트링/종아리/코어 중 최대 3개) · 휴식.

**부위 집중 day 처리**
- 선택 부위를 primary로 하는 운동만 후보로 삼아 STEP 6~8을 그대로 적용 (compound 우선 → isolation).
- 볼륨: 그 부위의 주간 목표에 집중 day 세트를 포함해 다시 분배한다. 다른 날 그 부위 세트를 먼저 줄이지 않고,
  합계가 출발점 범위 상한을 넘으면 "팔 볼륨이 출발점보다 많아요" 정보 표시 (부위 우선순위 상향으로 간주, +4세트까지 허용 · evidence: low).
- 인접일에 같은 근육이 나오면(예: 금 Pull → 토 팔의 이두) 경고 + 집중 day 쪽 해당 근육 세트를 자동 감소.
`validateCustomSplit(week)`가 즉시 검사한다. **막지 않고 알려준다** (안전·시간 제약만 강제):

| 검사 | 기준 | 표시 | 자동 수정 제안 |
|---|---|---|---|
| 같은 근육 연속일 | 같은 주동근을 primary로 쓰는 day가 연속 (예: Legs→Lower) | ! 경고 | 인접 요일 교환으로 해결되는 최소 교환 1개 (예: 목↔금) |
| 근육별 주간 빈도 | 주요 근육이 주 1회 이하 | ! 경고 | 해당 근육을 포함하는 day type 교체안 |
| 운동일 수 | 선택한 주 횟수와 다름 | 정보 | 설정의 주 횟수를 따라 갱신 |
| 세션 시간 | day별 예상시간 > 선택 시간 | 자동 압축 (STEP 8) | — (hard constraint) |
| 볼륨 분배 불가 | 근육 볼륨 목표를 세션당 상한 안에서 못 채움 | 정보 | "주간 세트가 출발점보다 낮아요" |

- 교환 제안은 결정적: 가능한 인접 교환 중 경고 수를 가장 많이 줄이는 것 → 동점이면 앞 요일 우선.
- 같은 이름의 day가 주에 2번 나오면 A/B 변형으로 자동 분리 (Upper A / Upper B: 메인 리프트 강도·운동 변형 다르게).
- 분할 변경은 **프로그램 재생성**이지만 `progression_state`는 운동 단위(exercise_id)로 이어받아 기록·중량이 초기화되지 않는다.

#### STEP 5 — 근육별 주간 볼륨 목표

```
target[m] = base(trainingAge) × goalVolumeMultiplier × priority[m]
            clamp to capacity share
goalVolumeMultiplier: Hypertrophy 1.0 · S+H 0.85 · Strength 0.7 · Maintain 0.6 · Power 0.5
priority[m]: 큰 근육/메인 리프트 주동근 1.0, 소근육 0.7~0.8 (중복 자극 고려)
세션당 근육별 상한: 약 8~10 hard sets (evidence: low — 초과분은 다른 날로 분산)
```
"주당 10세트 이상"은 **출발점 기준선 중 하나**로만 사용하고 고정 목표로 쓰지 않는다.
2차 기능에서 수행 추세에 따라 ±2세트씩 자동 조정(volume autoregulation).

#### STEP 6 — 운동 선택 (결정적 규칙)

각 day 템플릿은 **movement pattern 슬롯**으로 정의된다:
```
Upper A: [main: horizontal_push] [secondary: horizontal_pull] [secondary: vertical_push]
         [isolation: vertical_pull or lats] [isolation: side_delt] [isolation: triceps|biceps]
```
슬롯 채우기 우선순위:
1. 사용자가 1RM을 입력한 리프트 → main 슬롯 우선 배정
2. 장비 가능 여부, `excluded` 제외
3. difficulty ≤ 경력 상한
4. 주간 다양성: 같은 패턴 2회째 등장 시 변형 우선 (Bench → Incline/Close-grip), 단 strength 가중치 ≥0.5면 메인 리프트 반복 허용
5. 볼륨 목표 미달 근육을 primary로 갖는 운동 가산점
6. 동점은 exercise DB의 기본 순서(결정성 보장)

#### STEP 7 — 슬롯 처방 (reps/RIR → %1RM 일관성)

%1RM을 별도로 고르지 않고, **목표 반복수 + 목표 RIR → %1RM을 계산**해 부하와 반복수가 항상 서로 맞도록 한다.

```
reps_to_failure = target_reps + target_RIR_mid
pct = 1 / (1 + reps_to_failure / 30)          // Epley 역함수 (기본)
target_load = reference_1RM × pct → 원판 단위로 반올림
```
| reps + RIR | 4 | 5 | 6 | 7 | 8 | 10 | 12 | 15 |
|---|---|---|---|---|---|---|---|---|
| %1RM | 88% | 86% | 83% | 81% | 79% | 75% | 71% | 67% |

예: Bench 1RM 102kg, 근력+근비대 main 5 reps RIR 2 → 7 → 81.1% → 82.7 → **82.5kg × 5 × 4, 휴식 3:00**

휴식시간 결정:
```
rest = base(role, load)
  main  & pct ≥ 0.85 → 180–300s (기본 240)
  compound & 0.75–0.85 → 150–180s (기본 180)
  compound & < 0.75 → 120–150s (기본 120)
  isolation → 60–120s (기본 90)
  + goal 보정: strength↑ 쪽으로 +30s, maintain/시간 부족 시 범위 하한
  + 개인 보정: progression_state.next_rest_sec (rep drop 기반, §6-4)
```
워밍업 세트(메인/첫 compound만, 볼륨 미포함): 빈 바 ×10 → 40%×5 → 60%×3 → 80%×1 (목표 중량 대비).

#### STEP 8 — 세션 시간 맞추기 (Hard constraint)

```
time(exercise) = warmup_time
               + sets × (setup_sec + reps × rep_duration_sec)
               + (sets − 1) × rest_sec
time(session)  = general_warmup(5분) + Σ time(exercise) + (n_exercises − 1) × transition(90s)
superset: 두 운동의 세트를 번갈아 → 휴식 1회분 공유 (time = max 기준 + 전환 30s)
```
예상 시간 > 선택 시간이면 **아래 순서로 1단계씩 적용 후 재계산**, 만족하면 중단:
1. isolation 세트 −1 (각 운동 min_sets=2까지, 볼륨 목표 초과 근육부터)
2. secondary 세트 −1 (min_sets=2까지)  ← 아래 예시 B안에서는 3과 순서 교체 제안
3. superset 적용 (비경쟁 근육 쌍: 이두/삼두, 가슴/등 보조, 하체/코어)
4. isolation → secondary 순으로 운동 1개 삭제 (우선순위 낮은 것부터, 삭제 볼륨은 다른 날로 이전 시도)
5. (최후) isolation 휴식을 범위 하한까지 단축
**main 운동의 core sets(min_sets, 기본 3)는 절대 삭제하지 않는다.** 그래도 초과면 main 세트 수를 core까지만 줄이고 사용자에게 알림.

검증 예시 (Upper A, 60분, 근력+근비대):
```
Bench 4×5 rest 3:00        워밍업 6 + 2.7 + 9.0 = 17.7분
Row 3×8 rest 2:30          3.0 + 2.6 + 5.0      = 10.6분
OHP 3×8 rest 2:30                                 10.6분
Lat pulldown 3×10 rest 2:00                        6.5분
Lateral raise 3×12 rest 1:30                       5.6분
Triceps 3×12 / Biceps 3×12 rest 1:30           5.6 + 5.6분
+ 일반 워밍업 5 + 전환 6×1.5 = 14분            합계 ≈ 76분 → 초과

A안 (요청서 순서 그대로)
  (1) isolation 4종 세트 −1          → 66분
  (2) Row, OHP 세트 −1               → 59분 ✅  (보조 compound 볼륨 손실 큼)
B안 (제안: superset을 secondary 감소보다 먼저)
  (1) isolation 4종 세트 −1          → 66분
  (3) 삼두/이두, Lat pulldown/Lateral raise superset → 62분
  (2) OHP 세트 −1                    → 59분 ✅  (Row 3세트 보존)
```
> superset은 볼륨을 보존하면서 시간을 줄이므로, 세트 삭제보다 먼저 적용하는 B안을 기본값으로 제안한다 (확인 필요).

#### STEP 9 — 주간 볼륨 계산·검증

```
weeklySets[m] = Σ_days Σ_exercises (working_sets × contribution(exercise, m))
hard set 정의: working set 중 RIR ≤ 4 (워밍업 제외)
```
예: Chest = Bench 8×1.0 + Incline DB 6×1.0 + Dip 4×1.0 = 18 / Triceps = Bench 8×0.5 + Dip 4×0.5(…)
사용자 화면에는 `Chest: 18 sets/week`만 표시 (가중 계산은 숨김).

---

## 5. 중량 계산 방식 (Load Engine)

### 5-1. 기준 부하(reference) 결정 순서
1. **Tested 1RM** — 입력한 지 12주 이내면 사용 (이후엔 e1RM과 비교해 최신·신뢰도 높은 쪽)
2. **e1RM** — 최근 수행기록 (아래 공식, 추세 평활)
3. **관련 리프트 비율 추정** — 예: Incline DB(한 손) ≈ Bench × 0.3 (evidence: low → "추정, 첫 세트에서 조정" 라벨)
4. **Calibration** — 기준 없음 → 사용자가 첫 세트 무게 선택, 가이드 문구: "목표 횟수보다 2~3개 더 할 수 있는 무게"

### 5-2. e1RM 공식
```
기본(Epley + RIR):  e1RM = load × (1 + (reps + RIR) / 30)
대안(Brzycki):      e1RM = load × 36 / (37 − (reps + RIR))
reps=1, RIR=0 → e1RM = load
유효 범위: reps + RIR ≤ 12 에서만 e1RM 갱신에 사용 (그 이상은 오차↑ → 기록만, 갱신 X)
RIR 미입력 → RIR=0 가정하지 않고 target RIR을 보수적으로 사용 (과대추정 방지: min(target, 2))
"3+" → 3으로 계산 (보수적)
bodyweight 운동: load = bodyweight + added (체중 미입력 시 e1RM 계산 생략, rep 기반 진행)
```
세션 e1RM = 그 세션 working set 중 **최고 e1RM**.
기준 e1RM 갱신 = 지수평활 `ref ← ref + α(session − ref)`, 상승 α=0.5 / 하락 α=0.3 (하루 컨디션 과반응 방지), 세션당 변화 상한 +5% / −7.5%.
화면 표시: **"현재 추정 1RM: 116kg"**.

### 5-3. 반올림 & 단위
- 내부 저장: kg float. 계산 중간값은 반올림하지 않음 (누적 오차 방지).
- 표시/처방 시: 사용자 단위로 변환 후 장비 증분에 맞춰 반올림
  - barbell: kg 2.5 (마이크로 1.25) / lb 5
  - dumbbell: kg 2 (또는 헬스장 설정 1, 2.5) / lb 5
  - machine/cable: 2.5 또는 5 (설정)
- 반올림 규칙: 가장 가까운 값, **동률이면 내림**(안전 쪽). 증량 처방이 반올림 때문에 0이 되면 최소 1증분.
- `1 lb = 0.45359237 kg` 상수 고정, 왕복 변환 테스트 필수.

---

## 6. Progressive Overload 알고리즘 (Adjustment Engine)

### 6-1. 운동 결과 분류 (classify)

```
completion = Σ actual_reps / Σ target_reps            (working sets)
rirAvg     = 입력된 RIR 평균 (신뢰도 가중치 적용: novice 0.5 → 목표 RIR 쪽으로 당김)
Δ          = rirAvg − target_RIR_mid

completion = 100%:
   Δ ≥ +1         → EXCEED   (생각보다 쉬움)
   −0.5 ≤ Δ < +1  → SUCCESS
   Δ < −0.5       → GRIND    (다 했지만 한계에 가까움)
90% ≤ completion < 100% → PARTIAL
completion < 90%        → FAIL
```
임계값은 `evidence_level: heuristic`으로 표시되고 설정에서 조정 가능.

### 6-2. 메인 리프트 (load + RIR 모델)

| 결과 | 다음 세션 | 비고 |
|---|---|---|
| EXCEED | e1RM 기반 재계산, **최소 +1증분, 최대 +2증분(≈+5%)** | |
| SUCCESS | **+1증분** (novice 하체는 +2증분) | 근력 기대 상승 반영 |
| GRIND | 중량 유지 | stall_count +1 |
| PARTIAL | 중량 유지 (2회 연속이면 FAIL 처리) | stall_count +1 |
| FAIL | 목표의 strength 가중치 ≥ 0.5 → **중량 유지 + reps −1** (최소 3) / 그 외 → **중량 −2.5~5%, reps 유지** | fail_count +1 |
| 컨디션 😫 상태의 PARTIAL/FAIL | 한 단계 완화해 판정 (FAIL→PARTIAL→유지) | 하루 컨디션 과반응 방지 |

reps를 줄였던 경우 다음 SUCCESS에서 같은 중량으로 reps 복귀 → 그 다음부터 증량.

요청서 예시 검증:
- Bench 80kg 4×5, 5/5/5/5 RIR 2(목표 1–3, mid 2) → SUCCESS → **82.5kg**
- Squat 100kg 5×4, RIR 3(목표 2) → EXCEED → e1RM 재계산 결과 101.2→반올림 100 이지만 최소 +1증분 → **102.5kg**
- Squat 100kg 5/5/4/3, RIR 0–1 → completion 85% → FAIL → 근력+근비대(S=0.5) → **100kg × 4 × 4**,
  근비대 목표라면 **97.5kg × 5 × 4**

### 6-3. 보조/고립 (Double Progression)

```
rep range [lo, hi], sets n, load w
모든 세트 reps ≥ hi  AND  rirAvg ≥ target_RIR_min − 1
    → w += increment, 목표 reps = e1RM으로 예측한 새 중량의 가능 reps − target RIR, clamp [lo, hi]
       (덤벨처럼 증분이 상대적으로 큰 경우 자동으로 lo 근처로 리셋)
그 외 → 중량 유지, 각 세트 목표 reps = 지난 기록 + 1 (hi 상한)
어떤 세트든 reps < lo 가 2세션 연속 → w −5~10% (증분 반올림), stall_count 리셋
```
예: 50kg 3×(8–12), 12/12/12 → **52.5kg** / 10/9/8 → **50kg 유지**, 목표 11/10/9

### 6-4. 휴식시간 자동 조정

```
expected_drop = target RIR이 낮을수록 허용 폭↑ (RIR≥2: 1회, RIR≤1: 2회)
actual_drop   = reps(set1) − reps(last set)  (같은 중량일 때)
actual_drop > expected_drop + 1  → 다음 세션 rest +30s (role별 상한까지)
2세션 연속 drop 없음 & 휴식이 기본보다 길게 조정된 상태 → −15s (기본값까지)
```
세션 시간 제약을 넘기면 휴식 증가 대신 해당 운동 세트 −1 을 우선 고려.

### 6-5. 세션 내 자기조절 (calibration & 당일)
- 첫 working set 결과로 세션 e1RM을 즉시 계산 → 다음 세트 권장 중량을 ±1~2증분 범위에서 수정 제안 (사용자가 수락할 때만 변경).
- 메인 리프트는 세션 내 변경 폭을 ±5%로 제한.

---

## 7. RIR/RPE 반영 방식

- UI는 **"몇 개 더 할 수 있었나요?" [0] [1] [2] [3+]** 만 노출. RPE 용어는 숨김 (내부 RPE = 10 − RIR).
- 기본: 매 working set 후 1탭 (휴식 타이머 화면 위에 표시되어 추가 시간 비용 없음). 설정으로 "마지막 세트만" 가능.
- 미입력 세트는 결측으로 두고, 분류 시 입력된 세트만 사용. 모두 결측이면 completion만으로 판정 (RIR 항은 0으로).
- 경력별 신뢰도 가중치로 자가보고를 목표값 쪽으로 수축(shrinkage): `rir_used = target + trust × (reported − target)`.
- 사용 처: ① 분류(§6-1) ② e1RM 계산(§5-2) ③ 세션 내 자기조절 ④ deload 지표(지속적 RIR 하회).
- "0개" + 목표 reps 미달이 반복되면 실패 근접 과다 → 다음 세션 target RIR 상향(+1) 안내.

---

## 8. 주당 Volume 계산 방식

- 집계 단위: hard working set × contribution (primary 1.0 / secondary 0.5).
- **계획 볼륨**(program 기준)과 **실제 볼륨**(이번 주 기록 기준) 둘 다 계산.
- 주 경계: 사용자의 rotation 시작일 기준 7일 (달력 주 옵션).
- 사용자 표시: 근육별 `세트/주` 정수 반올림 + 출발점 범위 대비 상태(부족/적정/많음 — 색상만, 판정 문구는 "출발점 대비").
- Dashboard의 "Volume +8%" = 이번 주 총 tonnage(Σ load × reps, working) vs 최근 3주 평균.

---

## 9. Deload 판단 방식 (2차 기능, 설계는 지금)

고정 주기 없음. 메인 리프트별 지표를 매 세션 후 갱신, 주 단위로 점수화:

| 지표 | 조건 | 점수 |
|---|---|---|
| e1RM 추세 | 최근 3주 기울기 ≤ 0 (메인 리프트 2개 이상) | +2 |
| RIR 하회 | 실제 RIR이 목표보다 ≥1 낮은 세션 비율 > 50% (2주) | +1 |
| 완료율 | completion < 90% 세션 2회 이상 (2주) | +1 |
| stall_count | ≥ 3 인 메인 리프트 2개 이상 | +2 |
| readiness 추세 | 최근 2주 평균 ≤ 2 (별로 이하) | +1 |
| 연속 훈련 기간 | 마지막 deload 후 ≥ 6주 | +0.5 (단독으로는 트리거 X) |

**점수 ≥ 4 → 제안** (사용자가 [회복 주간 시작] / [나중에] 선택). 문구 예:
"최근 3주간 주요 리프트 수행량이 감소하고 남은 반복 수가 계속 적습니다. 이번 주는 회복 주간으로 조정하는 것을 권장합니다."

Deload 처방(1주): 세트 −40~50%, 중량 −5~10% (또는 중량 유지 + 볼륨만 감소), target RIR ≥ 3, 실패 금지.
종료 후: stall/fail 카운트 리셋, 기준 e1RM은 deload 전 값 유지, 첫 세션은 deload 전 중량의 −2.5%에서 재시작.

### Readiness(컨디션) 반영 (2차, MVP는 수집만 할지 결정 필요)

| 입력 | 당일 조정 |
|---|---|
| 😄 좋음 / 🙂 보통 | 변화 없음 |
| 😐 별로 | 보조/고립 target RIR +1 (중량은 유지) |
| 😫 매우 피곤 | 메인 중량 −5%, 보조/고립 세트 −1, target RIR +1 |
| 😫 3세션 연속 또는 2주 평균 ≤ 2 | deload 점수 반영 |
단발성 입력으로는 다음 세션 기준값(e1RM, progression_state)을 바꾸지 않는다.

---

## 10. 안전장치 (Safety)

- 운동 중 메뉴에 **[통증/불편감]** 버튼 → 선택지: 가벼운 불편감 / 날카로운 통증 / 급성 부상 의심 / 어지러움 / 가슴 통증 / 비정상적 호흡곤란
- **가벼운 불편감**: 해당 운동 증량 동결, 안내 "통증이 있다면 중량을 무리하게 증가시키지 말고 운동을 중단하거나 전문가의 평가를 받으세요."
- **날카로운 통증·급성 부상**: 해당 운동 즉시 종료, 남은 세트 건너뛰기 처리, 다음 세션에서 해당 운동 "확인 필요" 표시(대체 운동은 2차)
- **어지러움·가슴 통증·비정상 호흡곤란**: 세션 전체 중단 화면. "계속하기" 버튼을 강조하지 않음. 증상이 심하거나 지속되면 즉시 의료기관/응급 연락 안내.
- 의학적 진단·치료 문구 금지. 앱 최초 실행 시 고지 1회.
- 안전 이벤트가 있는 세션은 progression 판정에서 제외 (실패로 학습하지 않음).

---

## 11. MVP 화면 구조

| # | 화면 | 진입 | 핵심 |
|---|---|---|---|
| S1 | 온보딩 (4 스텝) | 최초 실행 | 큰 선택 카드, 1탭 진행, 1RM은 건너뛰기 가능 |
| S2 | 생성 완료 | S1 끝 | 자동 결정된 주간 분할 7칸 + 이유 + "프로그램 탭에서 변경 가능" |
| S6-b | 주간 분할 (추천+직접 통합) | 프로그램 탭 [분할 변경] | 프리셋 칩 → 요일 편집기, 경고 + 원탭 수정, 근육별 빈도 |
| S6-c | 요일 운동 고르기 (바텀시트) | S6-b 요일 탭 | 분할 / 부위 집중(최대 3) / 휴식, 미리보기(운동·시간·경고) |
| S3 | Today (홈) | 기본 탭 | 오늘 운동 카드 + 대시보드 3타일 |
| S4 | Workout Player | [운동 시작] | 현재 세트만 크게, 세트 완료/RIR/휴식 타이머 |
| S5 | Workout Summary | 마지막 세트 후 | 볼륨, PR, 다음 목표 |
| S6 | Program | 하단 탭 | 이번 주(요일별 day·완료 여부·예상시간) + 근육별 주간 세트 → day 상세 → [왜 이렇게 짰어?] |
| S7 | Progress | 하단 탭 | 운동별 추정 1RM·PR 목록 → 상세(e1RM 그래프 1개, 기록 리스트) |
| S8 | Settings | 하단 탭 | 단위, 체중, 1RM 수정, 목표/빈도/시간 변경(→재생성), 원판 증분, RIR 입력 방식 |

하단 탭: **오늘 · 프로그램 · 기록 · 설정** (4개)

---

## 12. 각 화면 UI/UX

공통: 다크 테마 기본, 주요 버튼은 **화면 하단 엄지 영역, 높이 ≥ 56px, 폭 전체**, 숫자는 대형 tabular 폰트,
운동 중 화면 꺼짐 방지(Wake Lock), 모든 탭은 즉시 로컬 저장(저장 버튼 없음), 햅틱/사운드는 휴식 종료 시만.

### S1 온보딩
```
┌─────────────────────────┐
│ 1/4                     │
│ 어떤 목표로 운동하나요?   │
│ ┌─────────────────────┐ │
│ │ 💪 근력               │ │
│ ├─────────────────────┤ │
│ │ 🏋️ 근비대             │ │
│ ├─────────────────────┤ │
│ │ ⚡ 근력 + 근비대       │ │  ← 탭하면 바로 다음 스텝
│ ├─────────────────────┤ │
│ │ 🔥 체지방 감소 + 근육 유지│ │
│ ├─────────────────────┤ │
│ │ 🏃 운동능력/파워       │ │
│ └─────────────────────┘ │
└─────────────────────────┘
```
1RM 스텝: 기본 4종(Squat/Bench/Deadlift/OHP)만 노출 + [다른 운동 추가]. 각 행 우측에 "모름" 토글.
"정확한 1RM 대신 '100kg × 5회'처럼 입력해도 됩니다" 보조 입력.

### S3 Today
```
┌─────────────────────────┐
│ 오늘 · Upper A    약 56분 │
│                         │
│ Bench Press             │
│ 82.5kg   4 × 5          │
│ 휴식 3분                 │
│ + 5개 운동 더보기 ▾       │
│                         │
│ ┌ 이번 주 ┐┌ 근력 ┐┌ 볼륨 ┐│
│ │ 4 / 5  ││Bench ││+8%  ││
│ │        ││+3.2% ││     ││
│ └────────┘└──────┘└─────┘│
│ ┌─────────────────────┐ │
│ │      운동 시작        │ │
│ └─────────────────────┘ │
└─────────────────────────┘
```
"근력" 타일은 최근 변화가 가장 의미 있는 메인 리프트 1개를 자동 선택 (4주 e1RM 변화율).

### S4 Workout Player
```
┌─────────────────────────┐
│ Bench Press      2 / 6  │ ← 운동 순서
│                         │
│        82.5 kg          │
│        × 5              │
│      Set 2 / 4          │
│                         │
│ [중량 변경] [반복수 변경]  │
│ ┌─────────────────────┐ │
│ │      세트 완료        │ │
│ └─────────────────────┘ │
└─────────────────────────┘
       ↓ 세트 완료
┌─────────────────────────┐
│ 휴식   02:31            │
│ [−15s]          [+15s]  │
│                         │
│ 몇 개 더 할 수 있었나요?  │
│ [ 0 ][ 1 ][ 2 ][ 3+ ]   │
│                         │
│ 다음: 82.5kg × 5 (3/4)  │
│ [휴식 건너뛰기]           │
└─────────────────────────┘
```
- 중량/반복 변경은 숫자 키보드 대신 **스테퍼(±증분)** 우선, 길게 누르면 직접 입력.
- 실제 반복수가 다르면 [반복수 변경] → 스테퍼 → 완료.
- 우상단 ⋯ : 통증/불편감, 운동 건너뛰기, 메모.
- 지난 기록 자동 프리필 (§25): 표시값 = 처방값, 변경 시에만 수정.

### S5 Summary
```
오늘 운동 완료 🎉        48분
Bench Press   82.5kg × 5 × 4   🔥 New PR (추정 1RM 101kg)
...
Total volume  6,420kg

다음 목표
Bench Press   85kg × 5 × 4
Row           62.5kg × 8 × 3
[확인]
```

### S6 Program / "왜 이렇게 짰어?"
- day 목록: `Upper A · 6개 운동 · 약 56분`
- 상세: 운동 × 세트 × 반복 × 휴식 표 (여기서만 표 사용)
- [왜 이렇게 짰어?] → 바텀시트: rationale 템플릿 3~5문장, 각 문장 옆 근거수준 배지(높음/중간/낮음). 논문 목록은 "출처 보기" 한 단계 더 안쪽.
- 근육별 주간 세트는 이 화면 하단 접힘 영역에 (MVP: 계산만, 표시는 2차 결정)

### S7 Progress
- 리스트: `Bench Press · 추정 1RM 104kg · ▲3.2% (4주)` / PR 배지
- 상세: e1RM 라인 그래프 1개, 최근 기록, PR 목록. tested 1RM은 점으로 구분 표시.
- 인사이트 문구(규칙 기반): "최근 6주 동안 벤치 추정 1RM이 8% 증가했습니다."

---

## 13. 향후 확장 구조

| 기능 | 확장 지점 |
|---|---|
| Supabase 동기화/로그인 | `db/` repository 인터페이스에 Supabase 구현 추가, 로컬 우선 + 백그라운드 sync (updated_at 기반 LWW) |
| Deload 자동 추천, fatigue | `engine/adjust/deload.ts`, `readiness.ts` (설계 완료, 플래그로 활성화) |
| 근육별 볼륨 분석 | `analytics/weeklyVolume.ts` 이미 MVP에 존재 → UI만 추가 |
| 다양한 split / 요일 지정 | `splitTemplates.ts` 데이터 추가 + scoring 그대로 사용 |
| AI 코칭 | `explain/`의 rationale code + 숫자 → LLM 프롬프트. **출력 검증기: 출력에 등장하는 숫자 ⊆ 입력 숫자, 아니면 템플릿 문구로 대체** |
| 운동 대체 | exercise DB의 movement_pattern + muscle contribution 유사도로 후보 산출 |
| 운동 영상 | exercises.media_url 필드 추가 |
| Volume autoregulation | progression_history 기반 근육별 ±2세트 |
| VBT(속도 기반) | workout_sets.velocity 컬럼 추가, power 목표에서 사용 |
| 프로그램 공유 | programs → 공유용 스냅샷 JSON (engine_version 포함) |

엔진은 `engine_version`을 가지며 프로그램·조정 로그에 기록 → 로직 변경 후에도 과거 처방 재현 가능.

---

## 14. 기술 스택 (권장)

| 영역 | 선택 | 이유 |
|---|---|---|
| Frontend | **Vite + React 18 + TypeScript** | 현 저장소가 Vite/React/Vercel 구성. SSR 불필요한 오프라인 PWA라 Next.js 이점 적음 (Next.js 원하면 전환 가능) |
| PWA | vite-plugin-pwa (Workbox) | 오프라인, 홈화면 설치 |
| 상태 | Zustand | 가볍고 운동 중 상태 관리 단순 |
| 로컬 DB | Dexie (IndexedDB) | 즉시 자동저장, 체육관 오프라인 대응 |
| 백엔드(2차) | Supabase (Postgres/Auth/RLS) | 스키마가 그대로 이전됨 |
| 스타일 | Tailwind CSS 또는 CSS Modules + 토큰 | 모바일 우선 |
| 차트 | 경량 SVG 직접 구현 또는 Recharts (Progress 상세에서만 lazy-load) | 초기 로딩 최소화 |
| 테스트 | **Vitest** (엔진 단위), Playwright (핵심 flow e2e) | |
| 품질 | ESLint 규칙: `engine/`에서 React/DB import 금지 | 로직 분리 강제 |

---

## 15. 테스트해야 할 핵심 로직

### Load / e1RM
- Epley/Brzycki: `100kg×5 RIR0` → Epley 116.7kg, reps=1·RIR0 → load 그대로
- reps+RIR > 12 → e1RM 갱신 안 함
- RIR 미입력 → 보수적 처리(과대추정 안 됨)
- 역함수 일관성: `e1RM(load(pct(r, rir)), r, rir) ≈ 1RM`
- 반올림: kg 2.5/1.25, lb 5, 덤벨 2 / 동률 내림 / 증량 시 최소 1증분
- kg↔lb 왕복 변환 오차 0 (표시 반올림 전)

### Prescription
- 같은 입력 → 같은 프로그램 (결정성, snapshot test)
- 3/4/5/6일 × 30/45/60/90분 × 5목표 × 3경력 = **180 조합 전부**: 모든 day의 예상시간 ≤ 선택 시간
- 위 전 조합에서 main core sets 유지됨
- 시간 압축 순서 준수 (isolation 세트 → secondary 세트 → superset → 운동 삭제)
- 근력 목표 main 평균 %1RM > 근비대 목표 main 평균 %1RM
- 근비대 목표 주요 근육 주간 세트 ≥ 출발점 하한 (시간 허용 시), 시간 부족 시 경고 플래그
- 세션당 근육 세트 상한 준수
- 1RM 0개 입력 시에도 프로그램 생성 성공 (calibration 표시)

### Weekly volume
- 요청서 예: Bench 8 + Incline 6 + Dip 4 → Chest 18
- secondary 0.5 가중, 워밍업 제외, RIR>4 세트 제외

### Progression
- 80kg 4×5, 5/5/5/5 RIR2 → 82.5
- 100kg 4×5, RIR3 (목표2) → 102.5 (+2증분 상한 준수)
- 100kg 5/5/4/3 RIR0–1 → S≥0.5: 100×4×4 / H: 97.5×5×4
- PARTIAL 1회 → 유지, 2회 연속 → 감소
- 😫 컨디션 + FAIL → 감소하지 않음
- Double progression: 12/12/12 → 52.5, 10/9/8 → 유지, lo 미달 2연속 → 감량
- 증분이 큰 덤벨: 증량 후 목표 reps가 범위 안으로 리셋
- 휴식: 과도한 rep drop → +30s, 상한 준수

### Analytics / PR
- PR 4종 판정, 워밍업 세트 PR 제외, 동일값은 PR 아님
- Dashboard: 주간 횟수, 4주 e1RM 변화율, 볼륨 변화율 (데이터 부족 시 표시 안 함)

### Deload / Safety
- 점수 계산 경계값(3.5 vs 4), 단일 지표로 트리거 안 됨, 6주 경과 단독 트리거 안 됨
- 위험 신호 입력 → 세션 중단 상태, 해당 세션 progression 제외

---

## 16. Evidence Base 초기 항목 (예시)

> ⚠️ 출처 서지정보와 세부 수치는 **구현 단계에서 원문을 다시 확인**하고 `verified=true`로 바꾼다.
> 특히 "2026 ACSM Position Stand"는 원문 확인 전까지 요청서에 적힌 방향성만 반영한다.

| variable | recommendation | level | source(검증 예정) | limitation |
|---|---|---|---|---|
| strength_load | 최대근력엔 높은 부하(대략 ≥80% 1RM)가 유리 | high | ACSM 2026; Lopez et al. 2021 (MSSE, load NMA); Currier et al. 2023 (BJSM, Bayesian NMA) | 주로 비고급자·단기 연구 |
| hypertrophy_load | 실패 근접 시 넓은 부하 범위(~30–85%)에서 유사한 근비대 | high | Lopez 2021; Schoenfeld 2017 load meta | 매우 저부하는 불편감·시간↑ |
| hypertrophy_weekly_sets | 주당 세트↑ → 근비대↑, 수확체감. ~10세트/주는 기준선 중 하나 | moderate | Schoenfeld 2017 dose-response; Pelland et al. (volume·frequency meta-regression) | 개인차 큼, 상한 불확실 |
| frequency | 볼륨이 같으면 빈도 자체 효과 작음 → 볼륨 분배 수단 | moderate | Schoenfeld 2016/2019; Grgic 2018 | |
| proximity_to_failure | 근비대는 실패 근접이 중요하나 매번 실패 불필요, 근력엔 실패 영향 작음 | moderate | Refalo et al. 2023/2024 | RIR 자가보고 오차 |
| rest_strength | 근력엔 ≥2–3분 휴식이 유리 | moderate | Grgic 2018 rest review | |
| rest_hypertrophy | 60초 초과 휴식이 약간 유리, 90초 이상부터 차이 작음 | low~moderate | Singer et al. 2024 (Bayesian); Schoenfeld 2016 | 연구 수 적음 |
| rir_accuracy | 경험↑·실패 근접↑일수록 RIR 정확도↑ | moderate | Zourdos 2016; Helms 2016 | |
| maintenance | 강도 유지 시 볼륨 1/3~2/3로도 일정 기간 유지 가능 | moderate | Spiering et al. 2021 | 감량 상황 직접 근거 제한 |
| deload | 볼륨 감소 중심, 강도 소폭 감소, 고정 주기보단 필요 기반 | low (expert consensus) | Bell et al. 2023 (Delphi) | 실험 근거 부족 |
| progression_thresholds | 결과 분류 임계값(90%, Δ±1 등) | heuristic | 코치 실무 기반 | 검증 필요, 로그로 튜닝 |
| time_constants | rep 3–4초, 전환 90초 등 | heuristic | 실측 기반 기본값 | 사용 기록으로 보정 |

### 테스트 추가 (v0.2 분할)
- `chooseSplit` 후보가 점수순·결정적, 추천 1개 + 대안 ≥ 2개
- `validateCustomSplit`: Legs→Lower 연속 경고, 목↔금 교환 제안이 경고를 0으로 만듦
- 주요 근육 주 1회 이하 → 경고, 운동일 수 불일치 → 정보
- custom 분할에서도 전 시간 조합에서 예상시간 ≤ 선택 시간
- 분할 변경 후 progression_state(중량·기록) 보존
- 부위 집중 day: 선택 부위 primary 운동만 배정, 인접일 동일 근육 경고 + 세트 자동 감소
- 프리셋 수정 시 split_source가 custom으로 바뀌고 "되돌리기"가 원래 추천을 정확히 복원
