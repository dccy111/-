import { useState } from 'react';
import { createProgram, saveOneRms, saveProfile, type OneRmInput } from '../app/useCases';
import { getExercise, ONBOARDING_LIFTS, OPTIONAL_1RM_LIFTS } from '../engine/data/exercises';
import { e1rm } from '../engine/load/e1rm';
import { fromUnit } from '../engine/load/units';
import type { Goal, TrainingAge, Unit, UserProfile } from '../engine/types';
import { Dots } from '../ui/components';

const GOALS: { id: Goal; em: string; t: string; s: string }[] = [
  { id: 'strength', em: '💪', t: '근력', s: '더 무거운 무게를 들기' },
  { id: 'hypertrophy', em: '🏋️', t: '근비대', s: '근육량 늘리기' },
  { id: 'strength_hypertrophy', em: '⚡', t: '근력 + 근비대', s: '둘 다 균형 있게' },
  { id: 'recomp', em: '🔥', t: '체지방 감소 + 근육 유지', s: '감량 중 근력 지키기' },
  { id: 'power', em: '🏃', t: '운동능력 / 파워', s: '빠르고 폭발적으로' },
];
const AGES: { id: TrainingAge; t: string; s: string }[] = [
  { id: 'novice', t: '처음 / 6개월 미만', s: '자세를 익히는 중이에요' },
  { id: 'intermediate', t: '6개월 ~ 2년', s: '꾸준히 해왔어요' },
  { id: 'advanced', t: '2년 이상', s: '기록이 잘 안 늘기 시작했어요' },
];

interface LiftDraft { mode: '1rm' | 'set'; kg: string; load: string; reps: string }

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<Goal>();
  const [days, setDays] = useState<UserProfile['daysPerWeek']>();
  const [minutes, setMinutes] = useState<UserProfile['sessionMinutes']>();
  const [age, setAge] = useState<TrainingAge>();
  const [unit, setUnit] = useState<Unit>('kg');
  const [lifts, setLifts] = useState<string[]>(ONBOARDING_LIFTS);
  const [draft, setDraft] = useState<Record<string, LiftDraft>>({});
  const [busy, setBusy] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const next = () => setStep((s) => s + 1);
  const back = () => setStep((s) => Math.max(0, s - 1));
  const d = (id: string): LiftDraft => draft[id] ?? { mode: '1rm', kg: '', load: '', reps: '' };
  const upd = (id: string, p: Partial<LiftDraft>) => setDraft((x) => ({ ...x, [id]: { ...d(id), ...p } }));

  async function finish() {
    setBusy(true);
    const profile: UserProfile = {
      goal: goal!, daysPerWeek: days!, sessionMinutes: minutes!, trainingAge: age!, unit,
      barbellIncrementKg: 2.5, rirPrompt: 'every_set',
    };
    await saveProfile(profile);
    const inputs: OneRmInput[] = lifts.map((id) => {
      const x = d(id);
      return x.mode === '1rm'
        ? { exerciseId: id, kg: x.kg ? fromUnit(+x.kg, unit) : undefined }
        : { exerciseId: id, load: x.load ? fromUnit(+x.load, unit) : undefined, reps: x.reps ? +x.reps : undefined };
    });
    await saveOneRms(inputs);
    await createProgram();
    onDone();
  }

  const header = (title: string, lead?: string) => (
    <>
      <div className="row">
        {step > 0 ? <button className="iconbtn" onClick={back} aria-label="뒤로">‹</button> : <span />}
        <span className="muted small num">{step + 1} / 5</span>
      </div>
      <Dots n={5} at={step} />
      <h1>{title}</h1>
      {lead && <div className="lead">{lead}</div>}
    </>
  );

  return (
    <div className="screen">
      {step === 0 && (
        <>
          {header('어떤 목표로 운동하나요?', '나중에 언제든 바꿀 수 있어요')}
          <div className="stack mt16">
            {GOALS.map((g) => (
              <button key={g.id} className={`opt ${goal === g.id ? 'sel' : ''}`} onClick={() => { setGoal(g.id); next(); }}>
                <span className="em">{g.em}</span>
                <span>{g.t}<small>{g.s}</small></span>
              </button>
            ))}
          </div>
        </>
      )}
      {step === 1 && (
        <>
          {header('주 몇 회 운동할까요?')}
          <div className="grid2 mt24">
            {([3, 4, 5, 6] as const).map((n) => (
              <button key={n} className={`bigopt num ${days === n ? 'sel' : ''}`} onClick={() => { setDays(n); next(); }}>
                {n}<small>회 / 주</small>
              </button>
            ))}
          </div>
        </>
      )}
      {step === 2 && (
        <>
          {header('한 번에 몇 분 운동할 수 있나요?', '이 시간을 넘지 않게 짜요')}
          <div className="grid2 mt24">
            {([30, 45, 60, 90] as const).map((n) => (
              <button key={n} className={`bigopt num ${minutes === n ? 'sel' : ''}`} onClick={() => { setMinutes(n); next(); }}>
                {n}<small>분</small>
              </button>
            ))}
          </div>
        </>
      )}
      {step === 3 && (
        <>
          {header('웨이트를 얼마나 해왔나요?', '볼륨과 무게를 올리는 속도를 정하는 데 써요')}
          <div className="stack mt16">
            {AGES.map((a) => (
              <button key={a.id} className={`opt ${age === a.id ? 'sel' : ''}`} onClick={() => { setAge(a.id); next(); }}>
                <span>{a.t}<small>{a.s}</small></span>
              </button>
            ))}
          </div>
        </>
      )}
      {step === 4 && (
        <>
          {header('아는 기록만 적어주세요', '비워둔 운동은 첫 세트에서 자동으로 맞춰져요')}
          <div className="seg mt12" style={{ width: 140 }}>
            {(['kg', 'lb'] as const).map((u) => <button key={u} className={unit === u ? 'on' : ''} onClick={() => setUnit(u)}>{u}</button>)}
          </div>
          <div className="stack mt12">
            {lifts.map((id) => {
              const ex = getExercise(id);
              const x = d(id);
              const est = x.mode === 'set' && +x.load > 0 && +x.reps > 0 && +x.reps <= 12 ? Math.round(e1rm(+x.load, +x.reps)) : null;
              return (
                <div key={id} className="liftrow">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="n">{ex.nameKo} {est != null && <span className="tag">추정 {est}{unit}</span>}</div>
                    <button className="s" onClick={() => upd(id, { mode: x.mode === '1rm' ? 'set' : '1rm' })}>
                      {x.mode === '1rm' ? '1RM 모름 → 최근 기록으로 입력' : '← 1RM으로 입력'}
                    </button>
                  </div>
                  {x.mode === '1rm' ? (
                    <label className="field"><input inputMode="decimal" placeholder="모름" value={x.kg} onChange={(e) => upd(id, { kg: e.target.value.replace(/[^\d.]/g, '') })} /><em>{unit}</em></label>
                  ) : (
                    <div className="row" style={{ gap: 4 }}>
                      <label className="field"><input style={{ width: 46 }} inputMode="decimal" placeholder={unit} value={x.load} onChange={(e) => upd(id, { load: e.target.value.replace(/[^\d.]/g, '') })} /></label>
                      <span className="muted">×</span>
                      <label className="field"><input style={{ width: 30 }} inputMode="numeric" placeholder="회" value={x.reps} onChange={(e) => upd(id, { reps: e.target.value.replace(/\D/g, '') })} /></label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {!showMore ? (
            <button className="link mt12" onClick={() => setShowMore(true)}>+ 다른 운동 추가</button>
          ) : (
            <div className="chips mt12">
              {OPTIONAL_1RM_LIFTS.filter((id) => !lifts.includes(id)).map((id) => (
                <button key={id} className="chip" onClick={() => setLifts((l) => [...l, id])}>{getExercise(id).nameKo}</button>
              ))}
            </div>
          )}
          <div className="hint mt12">💡 "100kg × 5회"처럼 최근 기록을 넣으면 <b>추정 1RM</b>으로 계산해요.</div>
          <div className="spacer" />
          <div className="dock"><button className="btn" disabled={busy} onClick={finish}>{busy ? '만드는 중…' : '프로그램 만들기'}</button></div>
        </>
      )}
    </div>
  );
}
