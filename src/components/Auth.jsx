import { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function Auth() {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    const { data, error } =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { data: { display_name: name } } });
    setBusy(false);
    if (error) return setMessage(error.message);
    if (mode === 'signup' && !data.session) setMessage('Check your email to confirm your account, then sign in.');
  }

  return (
    <div className="center">
      <form className="card narrow stack" onSubmit={submit}>
        <h1 className="brand big"><span className="dot me" /><span className="dot partner" /> Side by Side</h1>
        <p className="muted">Two schedules, one week. Plan workouts and dinners together.</p>
        {mode === 'signup' && (
          <label>Your name<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
        )}
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Password<input type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {message && <p className="notice">{message}</p>}
        <button className="primary" disabled={busy}>{mode === 'signin' ? 'Sign in' : 'Create account'}</button>
        <button type="button" className="link" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage(''); }}>
          {mode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in'}
        </button>
      </form>
    </div>
  );
}
