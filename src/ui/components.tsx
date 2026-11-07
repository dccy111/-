import { useEffect, useState, type ReactNode } from 'react';
import { formatLoad, fromUnit, toUnit } from '../engine/load/units';
import type { DayPlan, Unit } from '../engine/types';

export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null;
  return (
    <>
      <div className="dim-bg" onClick={onClose} />
      <div className="sheet" role="dialog">
        <div className="grab" />
        {children}
      </div>
    </>
  );
}

export function Dots({ n, at }: { n: number; at: number }) {
  return (
    <div className="progress-dots">
      {Array.from({ length: n }, (_, i) => <b key={i} className={i <= at ? 'on' : ''} />)}
    </div>
  );
}

/** Weight stepper working in the user's unit; value/onChange in kg. */
export function LoadStepper({ kg, unit, stepKg, onChange }: { kg: number; unit: Unit; stepKg: number; onChange: (kg: number) => void }) {
  const step = toUnit(stepKg, unit);
  const v = toUnit(kg, unit);
  const set = (nv: number) => onChange(fromUnit(Math.max(0, Math.round(nv / step) * step), unit));
  return (
    <div className="stepper">
      <button aria-label="감소" onClick={() => set(v - step)}>−</button>
      <div className="val">{formatLoad(kg, unit)}<small>{unit}</small></div>
      <button aria-label="증가" onClick={() => set(v + step)}>+</button>
    </div>
  );
}

export function RepStepper({ reps, onChange }: { reps: number; onChange: (n: number) => void }) {
  return (
    <div className="stepper">
      <button aria-label="감소" onClick={() => onChange(Math.max(0, reps - 1))}>−</button>
      <div className="val">{reps}<small>회</small></div>
      <button aria-label="증가" onClick={() => onChange(reps + 1)}>+</button>
    </div>
  );
}

export function dtClass(plan: DayPlan) {
  return `daytype dt-${plan.type}`;
}

export function Toast({ text, onDone }: { text: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [onDone]);
  return <div className="toast">{text}</div>;
}

export function useNow(intervalMs = 250) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];

export function fmtClock(sec: number) {
  const s = Math.max(0, Math.round(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
