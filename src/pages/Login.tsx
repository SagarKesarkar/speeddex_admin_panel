import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth';
import { Button, ErrorNote, Field } from '../components/ui';

export function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err);
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <div className="brand big">
          <img className="brand-logo" src={`${import.meta.env.BASE_URL}logo.png`} alt="SpeedDex" width={400} height={162} />
          <div className="brand-sub">Admin console</div>
        </div>
        <p className="muted">Sign in with a moderator or admin account.</p>
        <Field label="Email">
          {(id) => <input id={id} className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        <Field label="Password">
          {(id) => <input id={id} className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />}
        </Field>
        {error != null && <ErrorNote error={error} />}
        <Button kind="primary" type="submit" busy={busy} className="full">Sign in</Button>
        <p className="faint small">You stay signed in until you close this tab or sign out.</p>
      </form>
    </div>
  );
}
