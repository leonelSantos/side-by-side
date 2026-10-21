import { useCallback, useEffect, useState } from 'react';
import { supabase, isConfigured } from './supabaseClient';
import Auth from './components/Auth';
import PairSetup from './components/PairSetup';
import WeekView from './components/WeekView';
import Library from './components/Library';

export default function App() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!isConfigured) {
    return (
      <div className="center card narrow">
        <h1>Almost there</h1>
        <p>Copy <code>.env.example</code> to <code>.env.local</code>, add your Supabase URL and anon key, then restart <code>npm run dev</code>.</p>
      </div>
    );
  }
  if (session === undefined) return <div className="center muted">Loading…</div>;
  if (!session) return <Auth />;
  return <Home session={session} />;
}

function Home({ session }) {
  const userId = session.user.id;
  const [pair, setPair] = useState(undefined); // undefined = loading, null = not paired
  const [members, setMembers] = useState([]);
  const [tab, setTab] = useState('schedule');

  const load = useCallback(async () => {
    const { data: membership, error } = await supabase
      .from('pair_members')
      .select('pair_id, pairs(id, invite_code)')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) console.error(error);
    if (!membership) { setPair(null); return; }
    setPair(membership.pairs);
    const { data } = await supabase
      .from('pair_members')
      .select('user_id, profiles(id, display_name)')
      .eq('pair_id', membership.pair_id);
    setMembers((data ?? []).map((m) => m.profiles));
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // Notice when the partner joins while you're waiting on the invite screen
  useEffect(() => {
    if (!pair || members.length >= 2) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [pair, members.length, load]);

  if (pair === undefined) return <div className="center muted">Loading…</div>;
  if (pair === null) return <PairSetup onDone={load} />;

  const me = members.find((m) => m.id === userId) ?? { id: userId, display_name: 'Me' };
  const partner = members.find((m) => m.id !== userId);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><span className="dot me" /><span className="dot partner" /> Side by Side</div>
        <nav className="tabs">
          {[['schedule', 'Schedule'], ['workouts', 'Workouts'], ['foods', 'Dinner ideas']].map(([key, label]) => (
            <button key={key} className={tab === key ? 'on' : ''} onClick={() => setTab(key)}>{label}</button>
          ))}
        </nav>
        <div className="who">
          <span>{me.display_name}{partner ? ` & ${partner.display_name}` : ''}</span>
          <button className="ghost" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </header>

      {!partner && (
        <div className="banner">
          Waiting for your partner. Share this invite code with them: <strong className="code">{pair.invite_code}</strong>
        </div>
      )}

      <main>
        {tab === 'schedule' && <WeekView pair={pair} me={me} partner={partner} />}
        {tab === 'workouts' && <Library type="workouts" />}
        {tab === 'foods' && <Library type="foods" />}
      </main>
    </div>
  );
}
