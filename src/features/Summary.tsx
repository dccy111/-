import type { FinishedExercise } from '../app/useCases';
import { explain } from '../engine/explain/templates.ko';
import type { Program } from '../engine/types';
import { exName, loadLabel } from '../ui/format';

const PR_LABEL: Record<string, string> = { max_load: '최고 중량', reps_at_load: '최고 반복', e1rm: '추정 1RM', session_volume: '볼륨' };

export function Summary({ program, result, minutes, onClose }: { program: Program; result: FinishedExercise[]; minutes: number; onClose: () => void }) {
  const unit = program.inputs.unit;
  const done = result.filter((r) => r.sets.length);
  const totalVol = done.reduce((a, r) => a + r.volumeKg, 0);
  const totalSets = done.reduce((a, r) => a + r.sets.length, 0);
  const prs = done.filter((r) => r.prs.length);
  const coach = done
    .filter((r) => r.ruleCode)
    .slice(0, 2)
    .map((r) => `${exName(r.exerciseId)}: ${explain({ code: r.ruleCode!, level: 'heuristic' })}`);
  const volDisplay = unit === 'kg' ? totalVol : totalVol / 0.45359237;

  return (
    <div className="screen">
      <div style={{ fontSize: 42 }} className="mt8">🎉</div>
      <h1 className="mt8">오늘 운동 완료</h1>
      <div className="stats3 mt16">
        <div><div className="muted small">시간</div><div className="v">{minutes}분</div></div>
        <div><div className="muted small">총 볼륨</div><div className="v">{Math.round(volDisplay).toLocaleString()}<span className="muted" style={{ fontSize: 12 }}>{unit}</span></div></div>
        <div><div className="muted small">세트</div><div className="v">{totalSets}</div></div>
      </div>

      {prs.slice(0, 3).map((r) => (
        <div key={r.slotId} className="pr mt12">
          <div style={{ fontSize: 26 }}>🔥</div>
          <div>
            <div className="a">NEW PR · {r.prs.map((p) => PR_LABEL[p]).join(' · ')}</div>
            <div className="num" style={{ fontWeight: 600, marginTop: 2 }}>
              {exName(r.exerciseId)}{r.bestE1rmKg && r.prs.includes('e1rm') ? ` · 추정 1RM ${Math.round(unit === 'kg' ? r.bestE1rmKg : r.bestE1rmKg / 0.45359237)}${unit}` : ''}
            </div>
          </div>
        </div>
      ))}

      <div className="muted small mt24" style={{ fontWeight: 700 }}>오늘 한 운동</div>
      <div className="listcard mt8">
        {done.map((r) => {
          const loads = [...new Set(r.sets.map((s) => s.loadKg))];
          return (
            <div key={r.slotId} className="li">
              <span style={{ fontWeight: 700 }}>{exName(r.exerciseId)}</span>
              <span className="num muted" style={{ fontSize: 13.5 }}>
                {loads.length === 1 ? loadLabel(r.exerciseId, loads[0], unit) : `${loadLabel(r.exerciseId, Math.min(...loads), unit)}~`} × {r.sets.map((s) => s.reps).join('/')}
              </span>
            </div>
          );
        })}
      </div>

      <div className="muted small mt24" style={{ fontWeight: 700 }}>다음 운동 목표</div>
      <div className="listcard mt8">
        {done.filter((r) => r.next).map((r) => {
          const prevLoad = Math.max(...r.sets.map((s) => s.loadKg));
          const nextLoad = r.next!.loadKg ?? prevLoad;
          const diff = nextLoad - prevLoad;
          const prevReps = r.sets[0]?.reps ?? 0;
          const tag = diff > 1e-6 ? <span className="up">↑ 증량</span> : diff < -1e-6 ? <span className="down">↓ 조정</span> : r.next!.reps[0] > prevReps ? <span className="up">+회</span> : <span className="hold">유지</span>;
          return (
            <div key={r.slotId} className="li">
              <span style={{ fontWeight: 700 }}>{exName(r.exerciseId)}</span>
              <span className="num" style={{ fontWeight: 800 }}>
                {loadLabel(r.exerciseId, nextLoad, unit)} × {r.next!.reps[0]} × {r.next!.sets} {tag}
              </span>
            </div>
          );
        })}
      </div>
      {coach.length > 0 && <div className="coach mt12">{coach.map((c, i) => <div key={i}>{c}</div>)}</div>}
      <div className="spacer" />
      <div className="dock"><button className="btn" onClick={onClose}>확인</button></div>
    </div>
  );
}
