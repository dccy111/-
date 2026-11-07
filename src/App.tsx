import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { abandonSession, finishSession, getActiveProgram, getProfile, startSession, type FinishedExercise } from './app/useCases';
import { db } from './db/db';
import type { Readiness } from './engine/types';
import { Onboarding } from './features/Onboarding';
import { Player } from './features/Player';
import { ProgramDone } from './features/ProgramDone';
import { ProgramTab } from './features/ProgramTab';
import { ProgressTab } from './features/ProgressTab';
import { SettingsTab } from './features/SettingsTab';
import { Summary } from './features/Summary';
import { Today } from './features/Today';

type Tab = 'today' | 'program' | 'progress' | 'settings';
type Route =
  | { name: 'tabs' }
  | { name: 'done' }
  | { name: 'player'; sessionId: string }
  | { name: 'summary'; result: FinishedExercise[]; minutes: number };

const TABS: [Tab, string][] = [['today', '오늘'], ['program', '프로그램'], ['progress', '기록'], ['settings', '설정']];

export default function App() {
  const data = useLiveQuery(async () => ({ profile: await getProfile(), program: await getActiveProgram() }), []);
  const [tab, setTab] = useState<Tab>('today');
  const [route, setRoute] = useState<Route>({ name: 'tabs' });
  const [busy, setBusy] = useState(false);

  if (!data) return <div className="app" />;
  const { profile, program } = data;

  if (!profile || !program) {
    return <div className="app"><Onboarding onDone={() => setRoute({ name: 'done' })} /></div>;
  }

  async function onStart(dayId: string, readiness?: Readiness) {
    const day = program!.days.find((d) => d.id === dayId)!;
    const s = await startSession(program!, day, readiness);
    setRoute({ name: 'player', sessionId: s.id });
  }

  async function onFinish(sessionId: string) {
    if (busy) return;
    setBusy(true);
    const session = await db.sessions.get(sessionId);
    const result = await finishSession(sessionId);
    const minutes = session ? Math.max(1, Math.round((Date.now() - new Date(session.startedAt).getTime()) / 60000)) : 0;
    setBusy(false);
    setRoute({ name: 'summary', result, minutes });
  }

  if (route.name === 'done') return <div className="app"><ProgramDone program={program} onContinue={() => setRoute({ name: 'tabs' })} /></div>;
  if (route.name === 'player') {
    return (
      <div className="app">
        <Player
          program={program}
          sessionId={route.sessionId}
          onFinish={() => onFinish(route.sessionId)}
          onExit={async () => { await abandonSession(route.sessionId); setRoute({ name: 'tabs' }); }}
        />
      </div>
    );
  }
  if (route.name === 'summary') {
    return <div className="app"><Summary program={program} result={route.result} minutes={route.minutes} onClose={() => { setTab('today'); setRoute({ name: 'tabs' }); }} /></div>;
  }

  return (
    <div className="app">
      {tab === 'today' && <Today program={program} onStart={onStart} />}
      {tab === 'program' && <ProgramTab key={program.id} program={program} />}
      {tab === 'progress' && <ProgressTab program={program} />}
      {tab === 'settings' && <SettingsTab key={JSON.stringify(profile)} profile={profile} />}
      <nav className="tabbar">
        {TABS.map(([id, label]) => (
          <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            <span className="ico" />{label}
          </button>
        ))}
      </nav>
    </div>
  );
}
