import Dexie, { type Table } from 'dexie';
import type { PrRecord } from '../engine/analytics/records';
import type { LoggedSet, Outcome, Program, ProgressionState, Readiness, SafetyType, UserProfile } from '../engine/types';

/** Local-first storage (IndexedDB). Mirrors the Postgres schema in docs/DESIGN.md for a later Supabase sync. */

export interface MetaRow { key: string; value: unknown }

export interface RefRow {
  exerciseId: string;
  oneRmKg: number; // current reference used by the engine (smoothed e1RM or tested)
  source: 'tested' | 'estimated';
  testedKg?: number;
  testedAt?: string;
  updatedAt: string;
}

export interface SessionRow {
  id: string;
  programId: string;
  dayId: string;
  date: string; // YYYY-MM-DD
  startedAt: string;
  endedAt?: string;
  readiness?: Readiness;
  status: 'in_progress' | 'completed' | 'abandoned';
  safety?: SafetyType;
  /** Snapshot of what was prescribed when the session started. */
  plan: PlannedExercise[];
  cursor: number; // index into step queue
  restEndsAt?: number; // epoch ms
  restTotalSec?: number;
}

export interface PlannedExercise {
  slotId: string;
  exerciseId: string;
  role: 'main' | 'secondary' | 'isolation';
  sets: number;
  reps: number[];
  loadKg: number | null;
  restSec: number;
  repMin: number;
  repMax: number;
  rirMin: number;
  rirMax: number;
  supersetGroup?: string;
  calibration: boolean;
  skipped?: boolean;
  safety?: SafetyType;
}

export interface SetRow extends LoggedSet {
  id: string;
  sessionId: string;
  exerciseId: string;
  slotId: string;
  date: string;
  completedAt: string;
  restSecActual?: number;
}

export interface SummaryRow {
  key: string; // sessionId|slotId
  sessionId: string;
  exerciseId: string;
  slotId: string;
  date: string;
  bestE1rmKg: number | null;
  volumeKg: number;
  workingSets: number;
  outcome?: Outcome;
  ruleCode?: string;
}

export interface PrRow extends PrRecord { id: string; sessionId: string }

export interface AdjustLogRow {
  id: string;
  sessionId: string;
  slotId: string;
  exerciseId: string;
  ruleCode: string;
  before: ProgressionState;
  after: ProgressionState;
  createdAt: string;
}

export interface SafetyRow { id: string; sessionId: string; exerciseId?: string; type: SafetyType; createdAt: string }

class LiftDB extends Dexie {
  meta!: Table<MetaRow, string>;
  refs!: Table<RefRow, string>;
  programs!: Table<Program, string>;
  states!: Table<ProgressionState, string>;
  sessions!: Table<SessionRow, string>;
  sets!: Table<SetRow, string>;
  summaries!: Table<SummaryRow, string>;
  prs!: Table<PrRow, string>;
  adjustLog!: Table<AdjustLogRow, string>;
  safety!: Table<SafetyRow, string>;

  constructor(name = 'lift-loop') {
    super(name);
    this.version(1).stores({
      meta: 'key',
      refs: 'exerciseId',
      programs: 'id, createdAt',
      states: 'slotId, exerciseId',
      sessions: 'id, date, status, programId',
      sets: 'id, sessionId, exerciseId, date',
      summaries: 'key, sessionId, exerciseId, date',
      prs: 'id, exerciseId, date, sessionId',
      adjustLog: 'id, sessionId',
      safety: 'id, sessionId',
    });
  }
}

export const db = new LiftDB();

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined;
}
export async function setMeta(key: string, value: unknown) {
  await db.meta.put({ key, value });
}

export type { UserProfile };
