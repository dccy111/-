import type { Exercise, Unit } from '../types';

export const KG_PER_LB = 0.45359237;

export const kgToLb = (kg: number) => kg / KG_PER_LB;
export const lbToKg = (lb: number) => lb * KG_PER_LB;
export const toUnit = (kg: number, unit: Unit) => (unit === 'kg' ? kg : kgToLb(kg));
export const fromUnit = (v: number, unit: Unit) => (unit === 'kg' ? v : lbToKg(v));

/** Equipment increment expressed in the user's display unit. */
export function incrementIn(ex: Pick<Exercise, 'equipment' | 'incrementKg'>, unit: Unit, barbellIncrementKg = 2.5): number {
  if (unit === 'lb') return ex.equipment === 'machine' ? 10 : 5;
  if (ex.equipment === 'barbell') return Math.min(ex.incrementKg, barbellIncrementKg);
  return ex.incrementKg;
}

const EPS = 1e-9;

/**
 * Round to the nearest increment; exact ties round DOWN (safer).
 * Works in display unit to avoid lb plates being rounded on a kg grid.
 */
export function roundToIncrement(value: number, inc: number): number {
  const q = value / inc;
  const lower = Math.floor(q + EPS);
  const frac = q - lower;
  const steps = frac > 0.5 + EPS ? lower + 1 : lower;
  return +(steps * inc).toFixed(4);
}

/** Round a kg value onto the equipment grid of the user's unit and return kg. */
export function roundLoadKg(kg: number, ex: Pick<Exercise, 'equipment' | 'incrementKg'>, unit: Unit, barbellIncrementKg = 2.5): number {
  const inc = incrementIn(ex, unit, barbellIncrementKg);
  const rounded = roundToIncrement(toUnit(kg, unit), inc);
  return fromUnit(rounded, unit);
}

/** One increment step in kg for the user's unit. */
export function stepKg(ex: Pick<Exercise, 'equipment' | 'incrementKg'>, unit: Unit, barbellIncrementKg = 2.5): number {
  return fromUnit(incrementIn(ex, unit, barbellIncrementKg), unit);
}

/** Display string like "82.5" (no trailing zeros). */
export function formatLoad(kg: number, unit: Unit): string {
  const v = toUnit(kg, unit);
  const r = Math.round(v * 100) / 100;
  return Number.isInteger(r) ? String(r) : String(+r.toFixed(2));
}
