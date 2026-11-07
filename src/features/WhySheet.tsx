import { useState } from 'react';
import { RULES } from '../engine/evidence/rules';
import { SOURCES } from '../engine/evidence/sources';
import { explain, LEVEL_KO, muscleKo } from '../engine/explain/templates.ko';
import type { Program } from '../engine/types';
import { Sheet } from '../ui/components';

export function WhySheet({ program, open, onClose }: { program: Program; open: boolean; onClose: () => void }) {
  const [sources, setSources] = useState(false);
  const warn = program.warnings.filter((w) => w.code === 'VOLUME_BELOW_START');
  return (
    <Sheet open={open} onClose={onClose}>
      <h2>왜 이렇게 짰어요?</h2>
      <div className="stack mt16">
        {program.rationale.map((r, i) => {
          const t = explain(r);
          if (!t) return null;
          return (
            <div key={i} className="row" style={{ alignItems: 'flex-start' }}>
              <div style={{ fontSize: 14, lineHeight: 1.55, flex: 1 }}>{t}</div>
              <span className={`badge ${r.level}`}>{LEVEL_KO[r.level]}</span>
            </div>
          );
        })}
        {warn.length > 0 && (
          <div className="hint">
            시간 제약 때문에 {warn.map((w) => muscleKo(String(w.params?.muscle))).join(', ')} 주간 세트가 출발점보다 조금 낮아요.
          </div>
        )}
        <div className="hint">
          이 수치들은 연구에서 일반적으로 효과적인 <b>출발점</b>이에요. 정답이 아니라, 기록이 쌓이면서 나에게 맞게 조정돼요.
        </div>
      </div>
      <button className="link mt16" onClick={() => setSources((s) => !s)}>{sources ? '출처 닫기' : '근거와 출처 보기'}</button>
      {sources && (
        <div className="stack mt12">
          {RULES.map((r) => (
            <div key={r.id} className="card" style={{ padding: 12 }}>
              <div className="row"><b style={{ fontSize: 13.5 }}>{r.recommendation}</b><span className={`badge ${r.level}`}>{LEVEL_KO[r.level]}</span></div>
              <div className="muted small mt8">
                {r.sourceIds.map((id) => SOURCES.find((s) => s.id === id)?.citation).filter(Boolean).join(' · ')}
                {r.limitation && <> · 한계: {r.limitation}</>}
              </div>
            </div>
          ))}
          <div className="dim small">출처 서지정보는 원문 확인 후 갱신될 수 있어요.</div>
        </div>
      )}
      <button className="btn ghost mt16" onClick={onClose}>닫기</button>
    </Sheet>
  );
}
