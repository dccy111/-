import { explain } from '../engine/explain/templates.ko';
import { dayLabel, SPLIT_TEMPLATES } from '../engine/prescription/split';
import type { Program, WeekLayout } from '../engine/types';
import { dtClass, WEEKDAYS } from '../ui/components';

const GOAL_LABEL: Record<Program['goal'], string> = {
  strength: '💪 근력', hypertrophy: '🏋️ 근비대', strength_hypertrophy: '⚡ 근력 + 근비대', recomp: '🔥 감량 + 근육 유지', power: '🏃 파워',
};

export function WeekStrip({ layout }: { layout: WeekLayout }) {
  const short = (p: WeekLayout[number]) => (p.type === 'rest' ? '–' : p.type === 'upper' ? 'U' : p.type === 'lower' ? 'L' : dayLabel(p).slice(0, 4));
  return (
    <>
      <div className="wk7">{layout.map((p, i) => <div key={i} className={dtClass(p)}>{short(p)}</div>)}</div>
      <div className="wk7l">{WEEKDAYS.map((w) => <span key={w}>{w}</span>)}</div>
    </>
  );
}

export function splitName(program: Program) {
  return SPLIT_TEMPLATES.find((t) => t.id === program.splitId)?.nameKo ?? '직접 구성';
}

export function ProgramDone({ program, onContinue }: { program: Program; onContinue: () => void }) {
  const p = program.inputs;
  const lines = program.rationale.filter((r) => ['SPLIT_REASON', `GOAL_${p.goal.toUpperCase()}`, 'CALIBRATION'].includes(r.code));
  return (
    <div className="screen">
      <div className="okmark mt24">✓</div>
      <h1 className="mt16">프로그램을<br />만들었어요</h1>
      <div className="row mt12" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
        <span className="pill accent">{GOAL_LABEL[p.goal]}</span>
        <span className="pill">주 {p.daysPerWeek}회</span>
        <span className="pill">{p.sessionMinutes}분</span>
      </div>
      <div className="card mt16">
        <h3>{splitName(program)}</h3>
        <div className="mt12"><WeekStrip layout={program.layout} /></div>
      </div>
      <div className="card mt12" style={{ lineHeight: 1.6, fontSize: 14, color: '#d4d4d8' }}>
        {lines.map((l, i) => <p key={i} style={{ marginTop: i ? 6 : 0 }}>{explain(l)}</p>)}
      </div>
      <div className="muted small mt12">↻ 분할은 <span className="link" style={{ fontSize: 12.5 }}>프로그램 탭</span>에서 언제든 바꿀 수 있어요</div>
      <div className="dim small mt12" style={{ lineHeight: 1.5 }}>
        이 앱은 의학적 진단이나 치료를 제공하지 않아요. 운동 중 통증이 있으면 무리하지 말고 전문가와 상의하세요.
      </div>
      <div className="spacer" />
      <div className="dock"><button className="btn" onClick={onContinue}>오늘 운동 보기</button></div>
    </div>
  );
}
