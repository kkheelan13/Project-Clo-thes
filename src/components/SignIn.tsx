import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';

export function SignIn() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string>();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;

    setStatus('sending');
    setError(undefined);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });

    if (error) {
      setError(error.message);
      setStatus('idle');
    } else {
      setStatus('sent');
    }
  }

  if (status === 'sent') {
    return (
      <div className="panel centered">
        <h2>Check your inbox</h2>
        <p className="muted">
          We sent a sign-in link to <strong>{email}</strong>. Open it on this
          device to reach your wardrobe.
        </p>
      </div>
    );
  }

  return (
    <form className="panel centered" onSubmit={onSubmit}>
      <h2>Sign in</h2>
      <p className="muted">
        Your wardrobe syncs across devices. We&rsquo;ll email you a link &mdash;
        no password to remember.
      </p>
      <label className="field">
        <span>Email</span>
        <input
          type="email"
          value={email}
          required
          autoComplete="email"
          placeholder="you@example.com"
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={status === 'sending'}>
        {status === 'sending' ? 'Sending…' : 'Email me a link'}
      </button>
    </form>
  );
}
