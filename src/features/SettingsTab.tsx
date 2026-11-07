import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { createProgram, getActiveProgram, resetAll, saveOneRms, saveProfile } from '../app/useCases';
import { db } from '../db/db';
import { getExercise, ONBOARDING_LIFTS, OPTIONAL_1RM_LIFTS } from '../engine/data/exercises';
import { fromUnit, toUnit } from '../engine/load/units';
import type { Goal, TrainingAge, UserProfile } from '../engine/types';
import { Sheet } from '../ui/components';

const GOALS: [Goal, string][] = [['strength', '💪 근력'], ['hypertrophy', '🏋️ 근비대'], ['strength_hypertrophy', '⚡ 근력+근비대'], ['recomp', '🔥 감량+유지'], ['power', '🏃 파워']];
const AGES: [TrainingAge, string][] = [['novice', '6개월 미만'], ['intermediate', '6개월~2년'], ['advanced', '2년 이상']];

export function SettingsTab({ profile }: { profile: UserProfile }) {
  const [draft, setDraft] = useState(profile);
  const [busy, setBusy] = useState(false);
  const [oneRmOpen, setOneRmOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const programChanged = ['goal', 'daysPerWeek', 'sessionMinutes', 'trainingAge'].some((k) => draft[k as keyof UserProfile] !== profile[k as keyof UserProfile]);

  const apply = async (p: UserProfile) => {
    setDraft(p);
    await saveProfile(p);
  };

  async function regenerate() {
    setBusy(true);
    await saveProfile(draft);
    const active = await getActiveProgram();
    const keepCustom = active?.splitSource === 'custom' && draft.daysPerWeek === profile.daysPerWeek;
    await createProgram(keepCustom ? { layout: active!.layout, custom: true, scheduleMode: active!.scheduleMode } : {});
    setBusy(false);
  }

  const Seg = <T extends string | number>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) => (
    <div className="seg mt8">{options.map(([v, l]) => <button key={String(v)} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>)}</div>
  );

  return (
    <div className="screen with-tabs">
      <h1 style={{ fontSize: 25 }}>설정</h1>

      <h3 className="mt24">프로그램</h3>
      <div className="muted small mt8">목표</div>
      <div className="chips mt8">{GOALS.map(([g, l]) => <button key={g} className={`chip ${draft.goal === g ? 'on' : ''}`} onClick={() => setDraft({ ...draft, goal: g })}>{l}</button>)}</div>
      <div className="muted small mt12">주 횟수</div>
      <Seg value={draft.daysPerWeek} options={[[3, '3회'], [4, '4회'], [5, '5회'], [6, '6회']]} onChange={(v) => setDraft({ ...draft, daysPerWeek: v })} />
      <div className="muted small mt12">운동 시간</div>
      <Seg value={draft.sessionMinutes} options={[[30, '30분'], [45, '45분'], [60, '60분'], [90, '90분']]} onChange={(v) => setDraft({ ...draft, sessionMinutes: v })} />
      <div className="muted small mt12">운동 경력</div>
      <Seg value={draft.trainingAge} options={AGES} onChange={(v) => setDraft({ ...draft, trainingAge: v })} />
      {programChanged && (
        <button className="btn mt12" disabled={busy} onClick={regenerate}>{busy ? '다시 만드는 중…' : '이 설정으로 프로그램 다시 만들기'}</button>
      )}
      <button className="btn ghost mt12" onClick={() => setOneRmOpen(true)}>1RM 기록 수정</button>

      <h3 className="mt24">단위 · 장비</h3>
      <div className="muted small mt8">무게 단위</div>
      <Seg value={draft.unit} options={[['kg', 'kg'], ['lb', 'lb']]} onChange={(v) => apply({ ...draft, unit: v })} />
      <div className="muted small mt12">바벨 최소 증량 (원판)</div>
      <Seg value={draft.barbellIncrementKg} options={[[2.5, '2.5kg'], [1.25, '1.25kg (마이크로)']]} onChange={(v) => apply({ ...draft, barbellIncrementKg: v })} />
      <div className="muted small mt12">체중 (풀업·딥스 무게 계산용, 선택)</div>
      <label className="field mt8" style={{ width: 160 }}>
        <input inputMode="decimal" placeholder="미입력" defaultValue={draft.bodyweightKg ? Math.round(toUnit(draft.bodyweightKg, draft.unit) * 10) / 10 : ''}
          onBlur={(e) => apply({ ...draft, bodyweightKg: e.target.value ? fromUnit(+e.target.value, draft.unit) : undefined })} />
        <em>{draft.unit}</em>
      </label>

      <h3 className="mt24">기록 방식</h3>
      <div className="muted small mt8">"몇 개 더 할 수 있었나요?" 질문</div>
      <Seg value={draft.rirPrompt} options={[['every_set', '매 세트'], ['last_set', '마지막 세트만']]} onChange={(v) => apply({ ...draft, rirPrompt: v })} />

      <h3 className="mt24">안내</h3>
      <div className="hint mt8">
        이 앱은 의학적 진단이나 치료를 제공하지 않아요. 통증이 있다면 중량을 무리하게 올리지 말고 운동을 중단하거나 전문가의 평가를 받으세요.
        모든 기록은 이 기기에만 저장돼요.
      </div>
      <button className="btn ghost mt16" style={{ color: 'var(--warn)' }} onClick={() => setConfirmReset(true)}>모든 데이터 지우기</button>
      <div className="dim small mt12" style={{ textAlign: 'center' }}>Lift Loop v0.1</div>

      <OneRmSheet open={oneRmOpen} unit={draft.unit} onClose={() => setOneRmOpen(false)} />
      <Sheet open={confirmReset} onClose={() => setConfirmReset(false)}>
        <h2>모든 데이터를 지울까요?</h2>
        <div className="lead">프로그램, 기록, 1RM이 모두 삭제되고 되돌릴 수 없어요.</div>
        <button className="btn warn mt16" onClick={resetAll}>지우기</button>
        <button className="btn ghost mt8" onClick={() => setConfirmReset(false)}>취소</button>
      </Sheet>
    </div>
  );
}

function OneRmSheet({ open, unit, onClose }: { open: boolean; unit: 'kg' | 'lb'; onClose: () => void }) {
  const refs = useLiveQuery(() => db.refs.toArray(), []) ?? [];
  const [vals, setVals] = useState<Record<string, string>>({});
  const ids = [...ONBOARDING_LIFTS, ...OPTIONAL_1RM_LIFTS];
  async function save() {
    const entries = Object.entries(vals).filter(([, v]) => v);
    await saveOneRms(entries.map(([id, v]) => ({ exerciseId: id, kg: fromUnit(+v, unit) })));
    if (entries.length) {
      const active = await getActiveProgram();
      await createProgram({ layout: active?.splitSource === 'custom' ? active.layout : undefined, splitId: active?.splitId, scheduleMode: active?.scheduleMode, custom: active?.splitSource === 'custom', refreshMain: true });
    }
    setVals({});
    onClose();
  }
  return (
    <Sheet open={open} onClose={onClose}>
      <h2>1RM 기록</h2>
      <div className="lead">새로 측정한 값만 입력하세요. 메인 리프트 무게가 바로 다시 계산돼요.</div>
      <div className="stack mt16">
        {ids.map((id) => {
          const r = refs.find((x) => x.exerciseId === id);
          return (
            <div key={id} className="liftrow">
              <div style={{ flex: 1 }}>
                <div className="n">{getExercise(id).nameKo}</div>
                <div className="s">{r ? `현재 ${r.source === 'tested' ? '' : '추정 '}${Math.round(toUnit(r.oneRmKg, unit))}${unit}` : '기록 없음'}</div>
              </div>
              <label className="field"><input inputMode="decimal" placeholder="—" value={vals[id] ?? ''} onChange={(e) => setVals({ ...vals, [id]: e.target.value.replace(/[^\d.]/g, '') })} /><em>{unit}</em></label>
            </div>
          );
        })}
      </div>
      <button className="btn mt16" onClick={save}>저장</button>
    </Sheet>
  );
}
