# Lift Loop — 근거 기반 웨이트 트레이닝

1RM·목표·주 횟수·운동 시간을 입력하면 근거 기반 프로그램을 만들고,
실제 수행 기록(무게·반복·"몇 개 더 할 수 있었나요?")으로 다음 운동을 자동 조정하는 모바일 우선 PWA.

```
Program → Execute → Record → Adapt → Program
```

## 실행

```bash
npm install
npm run dev        # 개발 서버
npm test           # 엔진 단위 테스트 + DB 루프 통합 테스트
npm run build      # 타입체크 + 프로덕션 빌드 (dist/)
```

Vercel: `vercel.json` 그대로 배포 (build: `npm run build`, output: `dist`).

## 구조

```
src/
  engine/            순수 TypeScript 처방 엔진 (React/DB 의존 없음)
    evidence/        Evidence Base — 모든 수치 기본값 + 근거수준 + 출처
    data/            운동 DB(근육 기여도 primary 1.0 / secondary 0.5), 근육
    prescription/    목표 블렌딩, 분할 점수화·검증, 운동 선택, 세트/반복/RIR→%1RM,
                     시간 예산(초과 불가), 주간 볼륨
    load/            e1RM(Epley 기본·Brzycki), kg/lb, 원판 반올림
    adjust/          결과 분류, 메인 리프트 진행, double progression, 휴식 조정, 세션 내 보정
    analytics/       PR, 볼륨, 주차 계산
    safety/          통증/위험 신호 → 진행 동결·운동 종료·세션 종료
    explain/         처방 이유 코드 → 한국어 문장 (숫자는 엔진 값만 사용)
  db/                IndexedDB(Dexie) 로컬 저장 — 오프라인, 즉시 자동 저장
  app/               use-cases (엔진 ↔ DB)
  features/          화면: 온보딩, 오늘, 운동 중, 완료, 프로그램/분할 편집, 기록, 설정
docs/DESIGN.md       설계 문서 · docs/mockup/ 화면 시안
```

설계 결정과 알고리즘 설명은 [docs/DESIGN.md](docs/DESIGN.md)를 보세요.

> 의학적 진단·치료 앱이 아닙니다. 통증이 있으면 운동을 중단하고 전문가와 상의하세요.
