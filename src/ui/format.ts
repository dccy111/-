import { getExercise } from '../engine/data/exercises';
import { formatLoad } from '../engine/load/units';
import type { Unit } from '../engine/types';

export const exName = (id: string) => getExercise(id).nameKo;

/** "82.5kg", "맨몸", "맨몸 +5kg", "24kg" (dumbbell, per hand), or "무게 선택". */
export function loadLabel(exerciseId: string, kg: number | null, unit: Unit): string {
  const ex = getExercise(exerciseId);
  if (kg == null) return '무게 선택';
  if (ex.bodyweightLoaded) return kg > 0 ? `맨몸 +${formatLoad(kg, unit)}${unit}` : '맨몸';
  return `${formatLoad(kg, unit)}${unit}`;
}

/** "4세트 × 5회" or "3세트 × 8–12회" for ranges. */
export function setsLabel(sets: number, reps: number[] | number, range?: [number, number]): string {
  const r = Array.isArray(reps) ? reps : [reps];
  const same = r.every((x) => x === r[0]);
  if (range && range[0] !== range[1] && !same) return `${sets}세트 × ${range[0]}–${range[1]}회`;
  return `${sets}세트 × ${same ? r[0] : r.join('/')}회`;
}

/** Korean subject particle: 이 after a final consonant, 가 otherwise. */
export function iGa(word: string) {
  const c = word.charCodeAt(word.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return `${word}이(가)`;
  return (c - 0xac00) % 28 ? `${word}이` : `${word}가`;
}

export function restLabel(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (!m) return `${s}초`;
  return s ? `${m}분 ${s}초` : `${m}분`;
}

export function signedPct(p: number) {
  const r = Math.round(p * 10) / 10;
  return `${r > 0 ? '▲ ' : r < 0 ? '▼ ' : ''}${Math.abs(r)}%`;
}
