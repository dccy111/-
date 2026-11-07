import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { dashboard, nextWorkout, planFor, todayIso, weekdayIndex } from '../app/useCases';
import { db } from '../db/db';
import type { Program, Readiness } from '../engine/types';
import { Sheet, WEEKDAYS } from '../ui/components';
import { exName, loadLabel, restLabel, setsLabel, signedPct } from '../ui/format';

const READY: { v: Readiness; em: string; t: string }[] = [
  { v: 4, em: '😄', t: '좋음' }, { v: 3, em: '🙂', t: '보통' }, { v: 2, em: '😐', t: '별로' }, { v: 1, em: '😫', t: '매우 피곤' },
];

export function Today({ program, onStart }: { program: Program; onStart: (dayId: string, readiness?: Readiness) => void }) {
  const today = todayIso();
  const sessions = useLiveQuery(() => db.sessions.toArray(), []) ?? [];
  const nw = nextWorkout(program, sessions, today);
  const plan = useLiveQuery(() => (nw ? planFor(nw.day) : Promise.resolve([])), [nw?.day.id, sessions.length]) ?? [];
  const dash = useLiveQuery(() => dashboard(program, today), [program.id, sessions.length]);
  const inProgress = sessions.find((s) => s.status === 'in_progress');
  const [askReady, setAskReady] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const unit = program.inputs.unit;
  const d = new Date(today + 'T00:00:00');
  const first = plan[0];

  return (
    <div className="screen with-tabs">
      <div className="muted small">{d.getMonth() + 1}월 {d.getDate()}일 {WEEKDAYS[weekdayIndex(today)]}요일</div>
      {nw && !nw.isToday ? (
        <h1 className="mt8">오늘은 쉬는 날이에요</h1>
      ) : nw?.doneToday && program.scheduleMode === 'fixed_weekdays' ? (
        <h1 className="mt8">오늘 운동 완료 👏</h1>
      ) : (
        <h1 className="mt8">오늘은 이것만 하면 돼요</h1>
      )}

      {nw && first && (
        <div className="todaycard mt16">
          <div className="row">
            <span className="pill accent">{nw.isToday ? nw.day.label : `${WEEKDAYS[weekdayIndex(nw.date)]}요일 · ${nw.day.label}`}</span>
            <span className="pill num">⏱ 약 {nw.day.estMinutes}분</span>
          </div>
          <div className="big-ex">{exName(first.exerciseId)}</div>
          <div className="rx">
            <div className="w num">
              {first.loadKg == null ? <span style={{ fontSize: 28 }}>무게 선택</span> : loadLabel(first.exerciseId, first.loadKg, unit).replace(unit, '')}
              {first.loadKg != null && !loadLabel(first.exerciseId, first.loadKg, unit).startsWith('맨몸') && <small>{unit}</small>}
            </div>
          </div>
          <div className="row mt8" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
            <span className="pill num">{setsLabel(first.sets, first.reps)}</span>
            <span className="pill">휴식 {restLabel(first.restSec)}</span>
            <span className="pill">{first.rirMin === first.rirMax ? first.rirMin : `${first.rirMin}~${first.rirMax}`}개 남기기</span>
          </div>
          <div className="morelist">
            {(expanded ? plan.slice(1) : plan.slice(1, 3)).map((p) => (
              <div key={p.slotId} className="li">
                <span>{exName(p.exerciseId)}</span>
                <span>{loadLabel(p.exerciseId, p.loadKg, unit)} · {p.sets}×{p.reps[0]}</span>
              </div>
            ))}
            {plan.length > 3 && (
              <button className="li" style={{ width: '100%' }} onClick={() => setExpanded((e) => !e)}>
                <span>{expanded ? '접기' : `+ ${plan.length - 3}개 운동 더`}</span><span>{expanded ? '▴' : '▾'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      <div className="tiles mt12">
        <div className="tile">
          <div className="t">이번 주</div>
          <div className="v num">{dash?.weekDone ?? 0} / {dash?.weekTarget ?? program.days.length}</div>
          <div className="wkbar">{Array.from({ length: program.days.length }, (_, i) => <b key={i} className={i < (dash?.weekDone ?? 0) ? 'on' : ''} />)}</div>
        </div>
        <div className="tile">
          <div className="t">{dash?.strength ? `${exName(dash.strength.exerciseId)} 추정 1RM` : '근력'}</div>
          {dash?.strength ? (
            <>
              <div className="v num">{Math.round(unit === 'kg' ? dash.strength.e1rm : dash.strength.e1rm / 0.45359237)}</div>
              <div className={`d num ${dash.strength.changePct < 0 ? 'neg' : ''}`}>{signedPct(dash.strength.changePct)}</div>
            </>
          ) : <div className="muted small mt8">기록이 쌓이면 보여드려요</div>}
        </div>
        <div className="tile">
          <div className="t">볼륨</div>
          {dash?.volumeChangePct != null ? (
            <>
              <div className="v num">{dash.volumeChangePct >= 0 ? '+' : ''}{Math.round(dash.volumeChangePct)}%</div>
              <div className="d" style={{ color: 'var(--muted)' }}>지난 3주 대비</div>
            </>
          ) : <div className="muted small mt8">기록이 쌓이면 보여드려요</div>}
        </div>
      </div>

      <div className="spacer" />
      {nw && (
        <div className="dock">
          {inProgress ? (
            <button className="btn" onClick={() => onStart(inProgress.dayId)}>이어서 하기</button>
          ) : (
            <button className="btn" onClick={() => setAskReady(true)}>{nw.isToday ? '운동 시작' : '지금 하기'}</button>
          )}
        </div>
      )}

      <Sheet open={askReady} onClose={() => setAskReady(false)}>
        <h2>오늘 컨디션은 어때요?</h2>
        <div className="lead">기록만 해두고, 오래 이어지는 추세를 볼 때 써요</div>
        <div className="grid2 mt16">
          {READY.map((r) => (
            <button key={r.v} className="bigopt" style={{ fontSize: 28 }} onClick={() => { setAskReady(false); onStart(nw!.day.id, r.v); }}>
              {r.em}<small>{r.t}</small>
            </button>
          ))}
        </div>
        <button className="btn ghost mt12" onClick={() => { setAskReady(false); onStart(nw!.day.id); }}>건너뛰기</button>
      </Sheet>
    </div>
  );
}
