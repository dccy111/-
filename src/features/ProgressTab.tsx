import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db, type SummaryRow } from '../db/db';
import { pctChange } from '../engine/analytics/records';
import { getExercise } from '../engine/data/exercises';
import type { Program, Unit } from '../engine/types';
import { exName, signedPct } from '../ui/format';

const toU = (kg: number, unit: Unit) => (unit === 'kg' ? kg : kg / 0.45359237);
const PR_LABEL: Record<string, string> = { max_load: '최고 중량', reps_at_load: '최고 반복', e1rm: '추정 1RM', session_volume: '볼륨' };

export function ProgressTab({ program }: { program: Program }) {
  const unit = program.inputs.unit;
  const summaries = useLiveQuery(() => db.summaries.toArray(), []) ?? [];
  const refs = useLiveQuery(() => db.refs.toArray(), []) ?? [];
  const prs = useLiveQuery(() => db.prs.toArray(), []) ?? [];
  const [sel, setSel] = useState<string | null>(null);

  const ids = [...new Set([...refs.map((r) => r.exerciseId), ...summaries.map((s) => s.exerciseId)])];
  const rows = ids
    .map((id) => {
      const pts = summaries.filter((s) => s.exerciseId === id && s.bestE1rmKg).sort((a, b) => a.date.localeCompare(b.date));
      const ref = refs.find((r) => r.exerciseId === id);
      const first = pts[0]?.bestE1rmKg ?? ref?.testedKg;
      const last = pts[pts.length - 1]?.bestE1rmKg ?? ref?.oneRmKg;
      return { id, pts, ref, change: pts.length >= 2 ? pctChange(first, last) : null, current: ref?.oneRmKg ?? last, sessions: summaries.filter((s) => s.exerciseId === id).length };
    })
    .sort((a, b) => b.sessions - a.sessions || (b.current ?? 0) - (a.current ?? 0));

  if (sel) {
    const r = rows.find((x) => x.id === sel)!;
    return <Detail exerciseId={sel} unit={unit} pts={r.pts} current={r.current} tested={r.ref?.testedKg} prs={prs.filter((p) => p.exerciseId === sel)} onBack={() => setSel(null)} />;
  }

  const insight = rows.find((r) => r.change != null && r.pts.length >= 3);
  return (
    <div className="screen with-tabs">
      <h1 style={{ fontSize: 25 }}>기록</h1>
      {insight && insight.change != null && (
        <div className="coach mt12">
          최근 {weeksBetween(insight.pts[0].date, insight.pts[insight.pts.length - 1].date)}주 동안 {exName(insight.id)} 추정 1RM이 {Math.abs(Math.round(insight.change * 10) / 10)}% {insight.change >= 0 ? '증가' : '감소'}했어요.
        </div>
      )}
      {rows.length === 0 && <div className="hint mt16">운동을 기록하면 여기에서 추정 1RM과 개인 기록을 볼 수 있어요.</div>}
      <div className="listcard mt16">
        {rows.map((r) => (
          <button key={r.id} className="li" style={{ width: '100%', textAlign: 'left' }} onClick={() => setSel(r.id)}>
            <div>
              <div style={{ fontWeight: 700 }}>{exName(r.id)} {prs.some((p) => p.exerciseId === r.id) && <span className="tag">PR</span>}</div>
              <div className="muted small">{r.sessions}회 기록{r.ref?.source === 'tested' && !r.sessions ? ' · 입력한 1RM' : ''}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              {r.current && getExercise(r.id).oneRmApplicable ? <div className="num" style={{ fontWeight: 800 }}>{Math.round(toU(r.current, unit))}{unit}</div> : <div className="muted small">—</div>}
              {r.change != null && <div className={`small num ${r.change >= 0 ? 'up' : 'down'}`}>{signedPct(r.change)}</div>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function weeksBetween(a: string, b: string) {
  return Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / (7 * 86400000)));
}

function Detail({ exerciseId, unit, pts, current, tested, prs, onBack }: {
  exerciseId: string; unit: Unit; pts: SummaryRow[]; current?: number; tested?: number; prs: { type: string; value: number; date: string; loadKg: number; reps: number }[]; onBack: () => void;
}) {
  const sets = useLiveQuery(() => db.sets.where('exerciseId').equals(exerciseId).toArray(), [exerciseId]) ?? [];
  const bySession = new Map<string, typeof sets>();
  sets.forEach((s) => bySession.set(s.sessionId, [...(bySession.get(s.sessionId) ?? []), s]));
  const sessions = [...bySession.values()].sort((a, b) => b[0].completedAt.localeCompare(a[0].completedAt));
  const vals = pts.map((p) => toU(p.bestE1rmKg!, unit));
  const min = Math.min(...vals, tested ? toU(tested, unit) : Infinity) * 0.97;
  const max = Math.max(...vals, tested ? toU(tested, unit) : -Infinity) * 1.03;
  const W = 340, H = 160;
  const x = (i: number) => (vals.length <= 1 ? W / 2 : 16 + (i * (W - 32)) / (vals.length - 1));
  const y = (v: number) => H - 16 - ((v - min) / Math.max(1e-6, max - min)) * (H - 32);

  return (
    <div className="screen with-tabs">
      <div className="ptop"><button className="iconbtn" onClick={onBack}>‹</button><b>{exName(exerciseId)}</b><span style={{ width: 40 }} /></div>
      {current && getExercise(exerciseId).oneRmApplicable && (
        <div className="card mt16">
          <div className="muted small">현재 추정 1RM</div>
          <div className="num" style={{ fontSize: 40, fontWeight: 800 }}>{Math.round(toU(current, unit))}<span className="muted" style={{ fontSize: 18 }}>{unit}</span></div>
          {tested && <div className="muted small">입력한 1RM {Math.round(toU(tested, unit))}{unit}</div>}
        </div>
      )}
      {vals.length >= 2 && (
        <div className="card mt12">
          <div className="muted small">추정 1RM 변화</div>
          <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="추정 1RM 그래프">
            {tested && <line x1="0" x2={W} y1={y(toU(tested, unit))} y2={y(toU(tested, unit))} stroke="#5c5c63" strokeDasharray="4 4" />}
            <polyline fill="none" stroke="#d4ff3a" strokeWidth="2.5" points={vals.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
            {vals.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill="#d4ff3a" />)}
            <text x={x(vals.length - 1)} y={y(vals[vals.length - 1]) - 10} fill="#f4f4f5" fontSize="12" textAnchor="end">{Math.round(vals[vals.length - 1])}</text>
          </svg>
        </div>
      )}
      {prs.length > 0 && (
        <>
          <div className="muted small mt16" style={{ fontWeight: 700 }}>개인 기록</div>
          <div className="listcard mt8">
            {prs.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6).map((p, i) => (
              <div key={i} className="li"><span>🔥 {PR_LABEL[p.type]}</span><span className="num muted">{Math.round(toU(p.loadKg, unit) * 10) / 10}{unit} × {p.reps} · {p.date.slice(5)}</span></div>
            ))}
          </div>
        </>
      )}
      <div className="muted small mt16" style={{ fontWeight: 700 }}>최근 기록</div>
      <div className="listcard mt8">
        {sessions.slice(0, 10).map((ss) => (
          <div key={ss[0].sessionId} className="li">
            <span className="muted num">{ss[0].date.slice(5)}</span>
            <span className="num">{ss.sort((a, b) => a.setIdx - b.setIdx).map((s) => `${Math.round(toU(s.loadKg, unit) * 10) / 10}×${s.reps}`).join(', ')}</span>
          </div>
        ))}
        {!sessions.length && <div className="li muted">아직 기록이 없어요</div>}
      </div>
    </div>
  );
}
