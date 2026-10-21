import { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function PairSetup({ onDone }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(fn, args) {
    setBusy(true);
    setError('');
    const { error } = await supabase.rpc(fn, args);
    setBusy(false);
    if (error) return setError(error.message);
    onDone();
  }

  return (
    <div className="center">
      <div className="card narrow stack">
        <h1>Connect with your partner</h1>
        <p className="muted">One of you starts a pair and shares the code; the other joins with it.</p>
        <button className="primary" disabled={busy} onClick={() => run('create_pair')}>Start a new pair</button>
        <div className="divider"><span>or</span></div>
        <form className="row" onSubmit={(e) => { e.preventDefault(); run('join_pair', { code }); }}>
          <input placeholder="Invite code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} required />
          <button disabled={busy}>Join</button>
        </form>
        {error && <p className="error">{error}</p>}
        <button className="link" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
    </div>
  );
}
