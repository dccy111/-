import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { nextWorkout, planFor, todayIso, weekdayIndex } from '../app/useCases';
import { db } from '../db/db';
import { weekStart } from '../engine/analytics/records';
import { DISPLAY_MUSCLES } from '../engine/data/muscles';
import { muscleKo } from '../engine/explain/templates.ko';
import type { Program, ProgramDay } from '../engine/types';
import { Sheet, WEEKDAYS, dtClass } from '../ui/components';
import { exName, loadLabel, restLabel } from '../ui/format';
import { splitName } from './ProgramDone';
import { SplitEditor } from './SplitEditor';
import { WhySheet } from './WhySheet';

export function ProgramTab({ program }: { program: Program }) {
  const [editing, setEditing] = useState(false);
  const [why, setWhy] = useState(false);
  const [detail, setDetail] = useState<ProgramDay | null>(null);
  const ws = weekStart(todayIso());
  const allSessions = useLiveQuery(() => db.sessions.toArray(), []) ?? [];
  const weekSessions = allSessions.filter((s) => s.date >= ws);
  const nextId = nextWorkout(program, allSessions)?.day.id;
  const doneIds = new Set(weekSessions.filter((s) => s.status === 'completed').map((s) => s.dayId));
  const todayWd = weekdayIndex(todayIso());

  if (editing) return <SplitEditor program={program} onClose={() => setEditing(false)} />;

  const max = 20;
  const fixed = program.scheduleMode === 'fixed_weekdays';
  return (
    <div className="screen with-tabs">
      <div className="row">
        <h1 style={{ fontSize: 25 }}>이번 주</h1>
        <button className="pill accent" onClick={() => setEditing(true)}>분할 변경</button>
      </div>
      <div className="lead">{splitName(program)} · {fixed ? '요일 고정' : '순서대로'}</div>

      <div className="stack mt16" style={{ gap: 6 }}>
        {fixed
          ? program.layout.map((_p, wd) => {
              const day = program.days.find((d) => d.weekday === wd);
              if (!day) return <div key={wd} className="restline"><span style={{ width: 22 }}>{WEEKDAYS[wd]}</span>휴식</div>;
              return <DayRow key={wd} day={day} label={WEEKDAYS[wd]} done={doneIds.has(day.id)} today={wd === todayWd} unit={program.inputs.unit} onClick={() => setDetail(day)} />;
            })
          : program.days.map((day, i) => (
              <DayRow key={day.id} day={day} label={String(i + 1)} done={doneIds.has(day.id)} today={day.id === nextId} unit={program.inputs.unit} onClick={() => setDetail(day)} />
            ))}
      </div>

      <div className="row mt24">
        <h3>근육별 주간 세트</h3>
        <button className="link" onClick={() => setWhy(true)}>왜 이렇게 짰어?</button>
      </div>
      <div className="card mt8">
        {DISPLAY_MUSCLES.map((m) => {
          const v = program.plannedVolume[m] ?? 0;
          const t = program.volumeTargets[m];
          if (!t) return null;
          const inRange = v >= t[0];
          return (
            <div key={m} className="vrow">
              <span className="m">{muscleKo(m)}</span>
              <div className="track">
                <div className="band" style={{ left: `${(t[0] / max) * 100}%`, width: `${((t[1] - t[0]) / max) * 100}%` }} />
                <div className={`fill ${inRange ? 'in' : ''}`} style={{ width: `${Math.min(100, (v / max) * 100)}%` }} />
              </div>
              <span className="num" style={{ textAlign: 'right', fontWeight: 700, fontSize: 13 }}>{Math.round(v)}</span>
            </div>
          );
        })}
        <div className="dim small mt8">점선 = 출발점 범위 (세트/주) · 기록이 쌓이면 조정돼요</div>
      </div>

      <WhySheet program={program} open={why} onClose={() => setWhy(false)} />
      <DayDetail program={program} day={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

function DayRow({ day, label, done, today, onClick }: { day: ProgramDay; label: string; done: boolean; today: boolean; unit: string; onClick: () => void }) {
  const main = day.slots[0];
  return (
    <button className={`wday ${dtClass(day.plan)} ${done ? 'done' : ''} ${today ? 'today' : ''}`} onClick={onClick}>
      <span className="dl">{label}</span>
      <span className="bar" />
      <div>
        <div className="nm">{day.label}{done ? ' ✓' : ''}</div>
        <div className="sb">{main ? `${exName(main.exerciseId)} 외 ${day.slots.length - 1}개` : ''}{today ? ' · 다음 운동' : ''}</div>
      </div>
      <span className="tm num">{day.estMinutes}분</span>
    </button>
  );
}

function DayDetail({ program, day, onClose }: { program: Program; day: ProgramDay | null; onClose: () => void }) {
  const plan = useLiveQuery(() => (day ? planFor(day) : Promise.resolve([])), [day?.id]) ?? [];
  const unit = program.inputs.unit;
  return (
    <Sheet open={!!day} onClose={onClose}>
      {day && (
        <>
          <div className="row"><h2>{day.label}</h2><span className="pill num">약 {day.estMinutes}분</span></div>
          <table className="rx mt12">
            <tbody>
              {plan.map((p) => (
                <tr key={p.slotId}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{exName(p.exerciseId)}{p.supersetGroup && <span className="badge" style={{ marginLeft: 6 }}>슈퍼세트</span>}</div>
                    <div className="muted small">{p.role === 'main' ? '메인' : p.role === 'secondary' ? '보조' : '고립'} · 휴식 {restLabel(p.restSec)} · {p.rirMin}~{p.rirMax}개 남기기</div>
                  </td>
                  <td>
                    {loadLabel(p.exerciseId, p.loadKg, unit)}
                    <div className="muted small">{p.sets}세트 × {p.role === 'main' ? p.reps[0] : `${p.repMin}–${p.repMax}`}회</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {day.trimLog.length > 0 && <div className="hint mt12">{program.inputs.sessionMinutes}분 안에 끝나도록 일부 보조운동 세트를 줄였어요.</div>}
          <button className="btn ghost mt16" onClick={onClose}>닫기</button>
        </>
      )}
    </Sheet>
  );
}
