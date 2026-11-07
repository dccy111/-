import { useMemo, useState } from 'react';
import { createProgram, saveProfile } from '../app/useCases';
import { FOCUS_REGIONS, GROUP_NAME_KO } from '../engine/data/muscles';
import { generateProgram } from '../engine/prescription/generateProgram';
import { DAY_TYPE_LABEL, dayLabel, groupFrequency, groupsOf, rankSplits, validateLayout, type SplitIssue } from '../engine/prescription/split';
import type { DayPlan, DayType, FocusRegion, MuscleGroup, Program, ScheduleMode, UserProfile, WeekLayout } from '../engine/types';
import { Sheet, WEEKDAYS, dtClass } from '../ui/components';
import { exName, iGa } from '../ui/format';

const SPLIT_TYPES: DayType[] = ['upper', 'lower', 'push', 'pull', 'legs', 'full'];

const same = (a: WeekLayout, b: WeekLayout) => JSON.stringify(a) === JSON.stringify(b);

export function SplitEditor({ program, onClose }: { program: Program; onClose: () => void }) {
  const profile = program.inputs;
  const ranked = useMemo(() => rankSplits(profile), [profile]);
  const [layout, setLayout] = useState<WeekLayout>(program.layout);
  const [mode, setMode] = useState<ScheduleMode>(program.scheduleMode);
  const [picking, setPicking] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const preset = ranked.find((c) => same(c.template.layout, layout));
  const recommended = ranked[0];
  const diffFromRec = layout.filter((p, i) => JSON.stringify(p) !== JSON.stringify(recommended.template.layout[i])).length;
  const trainDays = layout.filter((p) => p.type !== 'rest').length;
  const issues = validateLayout(layout, trainDays);
  const freq = groupFrequency(layout);
  const warnDays = new Set(issues.filter((i) => i.code === 'ADJACENT_SAME_GROUP').flatMap((i) => i.days ?? []));

  // Preview minutes per day with the real engine (deterministic, cheap)
  const preview = useMemo(
    () => generateProgram({ ...profile, daysPerWeek: Math.min(6, Math.max(3, trainDays)) as 3 | 4 | 5 | 6 }, {}, { programId: 'preview', now: '', layout }),
    [layout, profile, trainDays],
  );

  async function save() {
    setSaving(true);
    const custom = !preset;
    if (trainDays !== profile.daysPerWeek) {
      await saveProfile({ ...profile, daysPerWeek: Math.min(6, Math.max(3, trainDays)) as 3 | 4 | 5 | 6 });
    }
    await createProgram({ layout: custom ? layout : undefined, splitId: preset?.template.id, scheduleMode: mode, custom });
    onClose();
  }

  const applyFix = (issue: SplitIssue) => {
    if (!issue.fix) return;
    const next = layout.slice();
    if (issue.fix.kind === 'swap') [next[issue.fix.a], next[issue.fix.b]] = [next[issue.fix.b], next[issue.fix.a]];
    else {
      const d = next[issue.fix.day];
      next[issue.fix.day] = { type: 'focus', focus: [...(d.focus ?? []), issue.fix.region as FocusRegion] };
    }
    setLayout(next);
  };

  const issueText = (i: SplitIssue) => {
    if (i.code === 'ADJACENT_SAME_GROUP')
      return { a: `${iGa((i.groups ?? []).map((g) => GROUP_NAME_KO[g]).join('·'))} 이틀 연속이에요 (${(i.days ?? []).map((d) => WEEKDAYS[d]).join('·')})`, b: '회복이 덜 된 상태로 같은 근육을 쓰게 돼요. 이 경우 연속된 날의 세트는 자동으로 줄여요.' };
    if (i.code === 'LOW_FREQUENCY') return { a: `${iGa(GROUP_NAME_KO[i.groups![0]])} 주 1회예요`, b: '주 2회 이상이 볼륨을 나누기 좋아요. 그대로 두어도 괜찮아요.' };
    return { a: `운동일이 주 ${trainDays}회예요`, b: `설정한 주 ${profile.daysPerWeek}회와 달라요. 저장하면 주 ${trainDays}회로 바뀌어요.` };
  };
  const fixLabel = (i: SplitIssue) =>
    i.fix?.kind === 'swap' ? `${WEEKDAYS[i.fix.a]} ↔ ${WEEKDAYS[i.fix.b]} 바꾸기` : i.fix?.kind === 'add_focus' ? `${WEEKDAYS[i.fix.day]}: ${FOCUS_REGIONS.find((r) => r.id === (i.fix as { region: string }).region)?.nameKo} 추가` : '';

  return (
    <div className="screen with-tabs">
      <div className="ptop">
        <button className="iconbtn" onClick={onClose} aria-label="뒤로">‹</button>
        <b>주간 분할</b>
        <span style={{ width: 40 }} />
      </div>
      <div className="presets mt16">
        {ranked.map((c, i) => (
          <button key={c.template.id} className={`pre ${preset?.template.id === c.template.id ? 'on' : i === 0 && !preset ? 'from' : ''}`} onClick={() => setLayout(c.template.layout)}>
            {i === 0 ? '★ 추천 · ' : ''}{c.template.nameKo}
          </button>
        ))}
      </div>
      <div className="row mt8 small">
        <span className="muted">{preset ? (preset === recommended ? '추천 분할이에요' : '다른 분할을 골랐어요') : <>추천에서 <b style={{ color: 'var(--text)' }}>{diffFromRec}곳 수정됨</b></>}</span>
        {!preset || preset !== recommended ? <button className="link" style={{ fontSize: 12.5 }} onClick={() => setLayout(recommended.template.layout)}>추천으로 되돌리기</button> : null}
      </div>
      <div className="seg mt12">
        <button className={mode === 'fixed_weekdays' ? 'on' : ''} onClick={() => setMode('fixed_weekdays')}>요일 고정</button>
        <button className={mode === 'rotation' ? 'on' : ''} onClick={() => setMode('rotation')}>순서대로 (빠지면 밀림)</button>
      </div>

      <div className="mt8">
        {layout.map((p, wd) => {
          const pd = preview.days.find((d) => d.weekday === wd);
          return (
            <div key={wd} className={`dayrow ${warnDays.has(wd) ? 'warn' : ''}`}>
              <span className="d">{WEEKDAYS[wd]}</span>
              <button className={`dtbtn ${dtClass(p)}`} onClick={() => setPicking(wd)}>
                {p.type === 'rest' ? '휴식' : dayLabel(p)}<span className="caret">▼</span>
              </button>
              {pd && (
                <div className="info"><b>{pd.estMinutes}분</b>{groupsOf(p).filter((g) => g !== 'core' && g !== 'calves').map((g) => GROUP_NAME_KO[g]).slice(0, 3).join('·')}</div>
              )}
            </div>
          );
        })}
      </div>

      {issues.map((i, k) => {
        const t = issueText(i);
        return (
          <div key={k} className="alert mt8">
            <div className="a">{t.a}</div>
            <div className="b">{t.b}</div>
            {i.fix && <button className="btn-sm warn mt8" onClick={() => applyFix(i)}>{fixLabel(i)}</button>}
          </div>
        );
      })}

      <div className="freq mt12">
        {(['chest', 'back', 'shoulders', 'biceps', 'quads'] as MuscleGroup[]).map((g) => {
          const n = g === 'biceps' ? Math.max(freq.biceps, freq.triceps) : g === 'quads' ? Math.max(freq.quads, freq.posterior) : freq[g];
          return (
            <div key={g}>
              <div className="m">{g === 'biceps' ? '팔' : g === 'quads' ? '하체' : GROUP_NAME_KO[g]}</div>
              <div className={`n ${n < 2 ? 'lo' : ''}`}>{n}회</div>
            </div>
          );
        })}
      </div>
      <div className="dim small mt12" style={{ textAlign: 'center' }}>저장해도 무게·기록은 그대로 이어져요</div>
      <div className="spacer" />
      <div className="dock"><button className="btn" disabled={saving || trainDays < 2} onClick={save}>{saving ? '다시 만드는 중…' : '저장하고 프로그램 다시 만들기'}</button></div>

      <DayPicker
        open={picking != null}
        weekday={picking ?? 0}
        current={picking != null ? layout[picking] : { type: 'rest' }}
        profile={profile}
        layout={layout}
        onClose={() => setPicking(null)}
        onApply={(plan) => {
          const next = layout.slice();
          next[picking!] = plan;
          setLayout(next);
          setPicking(null);
        }}
      />
    </div>
  );
}

function DayPicker({ open, weekday, current, layout, profile, onClose, onApply }: {
  open: boolean; weekday: number; current: DayPlan; layout: WeekLayout; profile: UserProfile; onClose: () => void; onApply: (p: DayPlan) => void;
}) {
  const [draft, setDraft] = useState<DayPlan>(current);
  const [lastKey, setLastKey] = useState('');
  const key = `${weekday}:${JSON.stringify(current)}:${open}`;
  if (key !== lastKey) { setLastKey(key); setDraft(current); }

  const focus = draft.type === 'focus' ? draft.focus ?? [] : [];
  const toggleRegion = (r: FocusRegion) => {
    const has = focus.includes(r);
    const next = has ? focus.filter((x) => x !== r) : focus.length >= 3 ? focus : [...focus, r];
    setDraft(next.length ? { type: 'focus', focus: next } : { type: 'rest' });
  };

  // Preview: exercises + minutes for this day, plus adjacency notes
  const previewLayout = layout.slice();
  previewLayout[weekday] = draft;
  const prog = draft.type !== 'rest' ? generateProgram(
    profile, {}, { programId: 'pick', now: '', layout: previewLayout },
  ) : null;
  const pd = prog?.days.find((d) => d.weekday === weekday);
  const neighbours = [(weekday + 6) % 7, (weekday + 1) % 7];
  const overlap = neighbours.flatMap((n) => groupsOf(layout[n]).filter((g) => groupsOf(draft).includes(g)).map((g) => ({ n, g })));

  return (
    <Sheet open={open} onClose={onClose}>
      <h2>{WEEKDAYS[weekday]}요일에 할 운동</h2>
      <div className="muted small mt16" style={{ fontWeight: 700 }}>분할</div>
      <div className="chips mt8">
        {SPLIT_TYPES.map((t) => (
          <button key={t} className={`chip ${draft.type === t ? `on ${dtClass({ type: t })}` : ''}`} onClick={() => setDraft({ type: t })}>{DAY_TYPE_LABEL[t]}</button>
        ))}
      </div>
      <div className="muted small mt16" style={{ fontWeight: 700 }}>부위 집중 · 여러 개 선택 가능 (최대 3)</div>
      <div className="chips mt8">
        {FOCUS_REGIONS.map((r) => (
          <button key={r.id} className={`chip ${focus.includes(r.id) ? 'on dt-focus' : ''}`} onClick={() => toggleRegion(r.id)}>{r.nameKo}</button>
        ))}
      </div>
      <div className="muted small mt16" style={{ fontWeight: 700 }}>기타</div>
      <div className="chips mt8">
        <button className={`chip ${draft.type === 'rest' ? 'on dt-rest' : ''}`} onClick={() => setDraft({ type: 'rest' })}>휴식</button>
      </div>
      {pd && (
        <div className="card mt16" style={{ background: '#0f0f11' }}>
          <b>{dayLabel(draft)} · 약 {pd.estMinutes}분</b>
          <div className="muted small mt8" style={{ lineHeight: 1.5 }}>{pd.slots.map((s) => exName(s.exerciseId)).join(' · ')}</div>
          {overlap.length > 0 && (
            <div className="small mt8" style={{ color: 'var(--warn)', fontWeight: 700 }}>
              ! {WEEKDAYS[overlap[0].n]}요일과 이어져서 {iGa([...new Set(overlap.map((o) => GROUP_NAME_KO[o.g]))].join('·'))} 이틀 연속이에요 — 겹치는 세트를 줄여서 짤게요
            </div>
          )}
        </div>
      )}
      <button className="btn mt16" onClick={() => onApply(draft)}>적용</button>
    </Sheet>
  );
}
