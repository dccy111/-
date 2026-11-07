import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildSteps, logSet, recordSafety, setRir, type Step } from '../app/useCases';
import { db, type SessionRow, type SetRow } from '../db/db';
import { suggestNextSetLoad } from '../engine/adjust/progression';
import { getExercise } from '../engine/data/exercises';
import { TIME } from '../engine/evidence/rules';
import { formatLoad, stepKg } from '../engine/load/units';
import { SAFETY_MESSAGE, SAFETY_OPTIONS, actionFor, type SafetyAction } from '../engine/safety/painFlags';
import type { Program, SafetyType } from '../engine/types';
import { LoadStepper, RepStepper, Sheet, fmtClock, useNow } from '../ui/components';
import { exName, loadLabel } from '../ui/format';

const DEFAULT_START: Record<string, number> = { barbell: 20, dumbbell: 8, machine: 20, cable: 10, bodyweight: 0 };

function warmupText(loadKg: number, unit: 'kg' | 'lb') {
  if (loadKg < 40) return null;
  const parts = [`빈 바 ×10`, `${formatLoad(Math.round(loadKg * 0.4 / 2.5) * 2.5, unit)} ×5`, `${formatLoad(Math.round(loadKg * 0.6 / 2.5) * 2.5, unit)} ×3`, `${formatLoad(Math.round(loadKg * 0.8 / 2.5) * 2.5, unit)} ×1`];
  return parts.join(' → ') + ` ${unit}`;
}

export function Player({ program, sessionId, onFinish, onExit }: { program: Program; sessionId: string; onFinish: () => void; onExit: () => void }) {
  const session = useLiveQuery(() => db.sessions.get(sessionId), [sessionId]);
  const logged = useLiveQuery(() => db.sets.where('sessionId').equals(sessionId).sortBy('completedAt'), [sessionId]) ?? [];
  if (!session) return null;
  return <PlayerInner program={program} session={session} logged={logged} onFinish={onFinish} onExit={onExit} />;
}

function PlayerInner({ program, session, logged, onFinish, onExit }: {
  program: Program; session: SessionRow; logged: SetRow[]; onFinish: () => void; onExit: () => void;
}) {
  const profile = program.inputs;
  const unit = profile.unit;
  const steps = useMemo(() => buildSteps(session.plan), [session.plan]);
  const now = useNow();
  const [sheet, setSheet] = useState<null | 'load' | 'reps' | 'menu' | 'safety' | 'exit'>(null);
  const [safetyMsg, setSafetyMsg] = useState<{ action: SafetyAction } | null>(null);
  const [repsOverride, setRepsOverride] = useState<number | null>(null);
  const buzzed = useRef(false);

  // keep the screen on during the workout
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => undefined);
    return () => void lock?.release();
  }, []);

  const isPending = (i: number) => {
    const s = steps[i];
    const p = session.plan[s.ex];
    return !p.skipped && !logged.some((l) => l.slotId === p.slotId && l.setIdx === s.set);
  };
  const nextPendingFrom = (from: number) => {
    for (let i = from; i < steps.length; i++) if (isPending(i)) return i;
    return -1;
  };
  const cur = nextPendingFrom(0);
  const step: Step | undefined = cur >= 0 ? steps[cur] : undefined;
  const plan = step ? session.plan[step.ex] : undefined;
  const ex = plan ? getExercise(plan.exerciseId) : undefined;
  const resting = session.restEndsAt != null;
  const lastSet = logged[logged.length - 1];
  const lastPlan = lastSet ? session.plan.find((p) => p.slotId === lastSet.slotId) : undefined;

  const prevForEx = plan ? logged.filter((l) => l.slotId === plan.slotId) : [];
  const currentLoad = plan ? plan.loadKg ?? prevForEx[prevForEx.length - 1]?.loadKg ?? (ex ? DEFAULT_START[ex.equipment] : 0) : 0;
  const targetReps = plan && step ? plan.reps[step.set] ?? plan.reps[plan.reps.length - 1] : 0;
  const reps = repsOverride ?? targetReps;
  const needsPick = !!plan && plan.loadKg == null && prevForEx.length === 0;

  async function updatePlan(exIdx: number, patch: Partial<SessionRow['plan'][number]>) {
    const p = session.plan.map((x, i) => (i === exIdx ? { ...x, ...patch } : x));
    await db.sessions.update(session.id, { plan: p });
  }

  async function completeSet() {
    if (!step || !plan) return;
    if (plan.loadKg == null) await updatePlan(step.ex, { loadKg: currentLoad });
    await logSet(session, step, currentLoad, reps);
    setRepsOverride(null);
    // rest: short switch inside a superset round, otherwise the prescribed rest
    const nxt = steps.findIndex((s, i) => i > cur && !session.plan[s.ex].skipped && !logged.some((l) => l.slotId === session.plan[s.ex].slotId && l.setIdx === s.set));
    const partnerNext = nxt >= 0 && plan.supersetGroup && session.plan[steps[nxt].ex].supersetGroup === plan.supersetGroup && steps[nxt].ex !== step.ex;
    const rest = partnerNext ? TIME.supersetSwitchSec : plan.restSec;
    buzzed.current = false;
    await db.sessions.update(session.id, { restEndsAt: Date.now() + rest * 1000, restTotalSec: rest, cursor: cur + 1 });
  }

  async function endRest() {
    await db.sessions.update(session.id, { restEndsAt: undefined });
  }
  async function shiftRest(sec: number) {
    if (session.restEndsAt) await db.sessions.update(session.id, { restEndsAt: Math.max(Date.now(), session.restEndsAt + sec * 1000), restTotalSec: Math.max(1, (session.restTotalSec ?? 0) + sec) });
  }

  async function onSafety(type: SafetyType) {
    const exIdx = step ? step.ex : null;
    const action = await recordSafety(session, exIdx, type);
    if (action === 'end_exercise' && exIdx != null) await updatePlan(exIdx, { skipped: true, safety: type });
    setSheet(null);
    setSafetyMsg({ action });
  }

  const remaining = session.restEndsAt ? (session.restEndsAt - now) / 1000 : 0;
  useEffect(() => {
    if (resting && remaining <= 0 && !buzzed.current) {
      buzzed.current = true;
      navigator.vibrate?.([200, 100, 200]);
    }
  }, [resting, remaining]);

  // ---- Safety: end of session screen
  if (safetyMsg?.action === 'end_session') {
    return (
      <div className="screen">
        <div className="danger mt24">
          <h2>운동을 멈춰주세요</h2>
          <p className="mt12" style={{ lineHeight: 1.6 }}>{SAFETY_MESSAGE.end_session}</p>
        </div>
        <div className="spacer" />
        <button className="btn ghost" onClick={onFinish}>운동 종료</button>
      </div>
    );
  }

  const done = cur < 0;
  const totalEx = session.plan.length;
  const showRir = lastSet && lastPlan && (profile.rirPrompt === 'every_set' || lastSet.setIdx === lastPlan.sets - 1);
  const suggestion =
    resting && lastSet && lastPlan && plan && lastPlan.slotId === plan.slotId && lastPlan.calibration && lastSet.rir != null
      ? suggestNextSetLoad(profile, program.days.flatMap((d) => d.slots).find((s) => s.id === plan.slotId)!, lastSet, targetReps)
      : null;

  const RirBox = showRir ? (
    <div className="rirbox">
      <div style={{ fontWeight: 900, fontSize: 18, textAlign: 'center' }}>몇 개 더 할 수 있었나요?</div>
      <div className="muted small num" style={{ textAlign: 'center', marginTop: 4 }}>
        {exName(lastSet.exerciseId)} · {loadLabel(lastSet.exerciseId, lastSet.loadKg, unit)} × {lastSet.reps}회
      </div>
      <div className="rir">
        {[0, 1, 2, 3].map((v) => (
          <button key={v} className={lastSet.rir === v ? 'sel' : ''} onClick={() => setRir(lastSet.id, v)}>{v === 3 ? '3+' : v}</button>
        ))}
      </div>
    </div>
  ) : null;

  return (
    <div className="screen">
      <div className="ptop">
        <button className="iconbtn" onClick={() => setSheet('exit')} aria-label="종료">✕</button>
        <div className="muted small num">
          {plan ? `운동 ${step!.ex + 1} / ${totalEx}` : '마무리'} · {fmtClock((now - new Date(session.startedAt).getTime()) / 1000)}
        </div>
        <button className="iconbtn" onClick={() => setSheet('menu')} aria-label="메뉴">⋯</button>
      </div>
      <div className="pbar">
        {session.plan.map((p, i) => {
          const n = logged.filter((l) => l.slotId === p.slotId).length;
          return <b key={p.slotId} className={n >= p.sets || p.skipped ? 'done' : step?.ex === i ? 'cur' : ''} />;
        })}
      </div>

      {safetyMsg && (
        <div className="alert mt12">
          <div className="a">{safetyMsg.action === 'freeze_progression' ? '무리하지 마세요' : '이 운동은 여기까지'}</div>
          <div className="b">{SAFETY_MESSAGE[safetyMsg.action]}</div>
          <button className="btn-sm mt8" onClick={() => setSafetyMsg(null)}>확인</button>
        </div>
      )}

      {resting ? (
        <>
          <div className="ring">
            <svg width="230" height="230">
              <circle cx="115" cy="115" r="104" stroke="#1e1e21" strokeWidth="12" fill="none" />
              <circle cx="115" cy="115" r="104" stroke={remaining > 0 ? '#d4ff3a' : '#5be49b'} strokeWidth="12" fill="none" strokeLinecap="round"
                strokeDasharray={653.5} strokeDashoffset={653.5 * (1 - Math.min(1, Math.max(0, remaining) / Math.max(1, session.restTotalSec ?? 1)))} />
            </svg>
            <div className="c">
              <div className="muted">{remaining > 0 ? '휴식' : '휴식 끝!'}</div>
              <div className="t num">{fmtClock(remaining)}</div>
            </div>
          </div>
          <div className="row mt8" style={{ justifyContent: 'center' }}>
            <button className="btn-sm num" onClick={() => shiftRest(-15)}>−15초</button>
            <button className="btn-sm num" onClick={() => shiftRest(15)}>+15초</button>
          </div>
          {RirBox}
          {suggestion != null && plan && Math.abs(suggestion - currentLoad) > 1e-6 && (
            <div className="suggest mt12">
              <span>다음 세트 추천 <b className="num">{loadLabel(plan.exerciseId, suggestion, unit)}</b></span>
              <button className="btn-sm accent" onClick={() => updatePlan(step!.ex, { loadKg: suggestion })}>적용</button>
            </div>
          )}
          <div className="spacer" />
          {done ? (
            <button className="btn" onClick={onFinish}>운동 완료</button>
          ) : (
            <div className="nextbox">
              <div>
                <div className="muted small">다음 · {exName(plan!.exerciseId)} {step!.set + 1}/{plan!.sets}</div>
                <div className="num" style={{ fontSize: 17, fontWeight: 700, marginTop: 2 }}>{loadLabel(plan!.exerciseId, currentLoad, unit)} × {targetReps}</div>
              </div>
              <button className="link" onClick={endRest}>{remaining > 0 ? '휴식 건너뛰기 →' : '다음 세트 →'}</button>
            </div>
          )}
        </>
      ) : done ? (
        <>
          <h1 className="mt24">모든 세트 완료!</h1>
          {RirBox}
          <div className="spacer" />
          <button className="btn" onClick={onFinish}>운동 완료</button>
        </>
      ) : (
        <>
          <div className="pex">{exName(plan!.exerciseId)}</div>
          <div className="muted small mt8">
            {plan!.rirMin === plan!.rirMax ? plan!.rirMin : `${plan!.rirMin}~${plan!.rirMax}`}개 남기는 무게
            {plan!.repMin !== plan!.repMax && plan!.role !== 'main' && ` · 목표 ${plan!.repMin}–${plan!.repMax}회`}
            {plan!.supersetGroup && ' · 슈퍼세트'}
          </div>
          {needsPick ? (
            <div className="mt16">
              <div className="hint">처음 하는 운동이에요. <b>목표 {targetReps}회보다 2~3개 더 할 수 있을 무게</b>를 골라주세요. 다음 세트부터 자동으로 맞춰요.{ex!.perHand && ' (덤벨 한 개 무게)'}</div>
              <div className="mt12">
                <LoadStepper kg={currentLoad} unit={unit} stepKg={stepKg(ex!, unit, profile.barbellIncrementKg)} onChange={(kg) => updatePlan(step!.ex, { loadKg: kg })} />
              </div>
              <div className="hero" style={{ marginTop: 18 }}><div className="r num">× {reps}</div></div>
            </div>
          ) : (
            <div className="hero">
              <div className="w num">
                {ex!.bodyweightLoaded && currentLoad === 0 ? <span style={{ fontSize: 56 }}>맨몸</span> : <>{ex!.bodyweightLoaded ? '+' : ''}{formatLoad(currentLoad, unit)}<small>{unit}</small></>}
              </div>
              <div className="r num">× {reps}</div>
              {ex!.perHand && <div className="muted small">덤벨 한 개 무게</div>}
            </div>
          )}
          <div className="setdots">
            {Array.from({ length: plan!.sets }, (_, i) => {
              const isDone = logged.some((l) => l.slotId === plan!.slotId && l.setIdx === i);
              return <b key={i} className={`num ${isDone ? 'done' : i === step!.set ? 'cur' : ''}`}>{isDone ? '✓' : i + 1}</b>;
            })}
          </div>
          {step!.set === 0 && plan!.role === 'main' && !needsPick && warmupText(currentLoad, unit) && (
            <div className="muted small mt12" style={{ textAlign: 'center' }}>워밍업 {warmupText(currentLoad, unit)}</div>
          )}
          <div className="spacer" />
          <div className="grid2">
            <button className="btn ghost" style={{ height: 52, fontSize: 15 }} onClick={() => setSheet('load')}>중량 변경</button>
            <button className="btn ghost" style={{ height: 52, fontSize: 15 }} onClick={() => setSheet('reps')}>반복수 변경</button>
          </div>
          <button className="btn big mt12" onClick={completeSet}>세트 완료</button>
        </>
      )}

      <Sheet open={sheet === 'load'} onClose={() => setSheet(null)}>
        <h2>중량 변경</h2>
        <div className="lead">이 운동의 남은 세트에 적용돼요</div>
        {ex && step && <div className="mt16"><LoadStepper kg={currentLoad} unit={unit} stepKg={stepKg(ex, unit, profile.barbellIncrementKg)} onChange={(kg) => updatePlan(step.ex, { loadKg: kg })} /></div>}
        <button className="btn mt16" onClick={() => setSheet(null)}>확인</button>
      </Sheet>
      <Sheet open={sheet === 'reps'} onClose={() => setSheet(null)}>
        <h2>반복수 변경</h2>
        <div className="lead">실제로 한 횟수를 입력하세요</div>
        <div className="mt16"><RepStepper reps={reps} onChange={setRepsOverride} /></div>
        <button className="btn mt16" onClick={() => setSheet(null)}>확인</button>
      </Sheet>
      <Sheet open={sheet === 'menu'} onClose={() => setSheet(null)}>
        <div className="stack">
          <button className="btn warn" onClick={() => setSheet('safety')}>통증 / 불편감</button>
          {step && <button className="btn ghost" onClick={async () => { await updatePlan(step.ex, { skipped: true }); setSheet(null); }}>이 운동 건너뛰기</button>}
          <button className="btn ghost" onClick={() => setSheet('exit')}>운동 끝내기</button>
        </div>
      </Sheet>
      <Sheet open={sheet === 'safety'} onClose={() => setSheet(null)}>
        <h2>어떤 증상인가요?</h2>
        <div className="lead">해당하는 것을 골라주세요</div>
        <div className="stack mt16">
          {SAFETY_OPTIONS.map((o) => (
            <button key={o.type} className={`btn ${actionFor(o.type) === 'end_session' ? 'warn' : 'ghost'}`} style={{ height: 52, fontSize: 15 }} onClick={() => onSafety(o.type)}>{o.labelKo}</button>
          ))}
        </div>
      </Sheet>
      <Sheet open={sheet === 'exit'} onClose={() => setSheet(null)}>
        <h2>운동을 끝낼까요?</h2>
        <div className="lead">{logged.length ? '지금까지 한 세트는 저장되고 다음 운동에 반영돼요.' : '아직 기록한 세트가 없어요.'}</div>
        <div className="stack mt16">
          {logged.length > 0 && <button className="btn" onClick={onFinish}>여기까지 저장하고 끝내기</button>}
          {!logged.length && <button className="btn warn" onClick={onExit}>운동 취소</button>}
          <button className="btn ghost" onClick={() => setSheet(null)}>계속하기</button>
        </div>
      </Sheet>
    </div>
  );
}
