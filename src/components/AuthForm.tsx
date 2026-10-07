'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { api, type ApiError } from '@/lib/api';
import { ErrorNotice, Field } from './ui';

export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const signup = mode === 'signup';
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/auth/${mode}`, { body: signup ? form : { email: form.email, password: form.password } });
      router.replace('/app');
      router.refresh();
    } catch (err) {
      setError(err as ApiError);
      setBusy(false);
    }
  }

  const fields = error?.fields ?? {};
  return (
    <div className="auth-card">
      <div className="auth-form-heading">
        <span className="auth-form-kicker">{signup ? 'YOUR STUDIO AWAITS' : 'BACK TO YOUR NEXT BIG IDEA'}</span>
        <h1>{signup ? 'Start your next chapter.' : 'Welcome back.'}</h1>
        <p>{signup ? 'Create your account. Give your next great idea a head start.' : 'Sign in to your studio. Your next outlier is waiting.'}</p>
      </div>
      <div className="auth-mode-links" aria-label="Account access">
        <Link href="/login" aria-current={!signup ? 'page' : undefined}>Sign in</Link>
        <Link href="/signup" aria-current={signup ? 'page' : undefined}>Create account</Link>
      </div>
      <form className="auth-fields" onSubmit={submit} noValidate aria-busy={busy}>
        {signup && (
          <Field label="Name" error={fields.name}>
            {(p) => <input {...p} className="input" name="name" placeholder="Your name" value={form.name} onChange={set('name')} autoComplete="name" disabled={busy} required maxLength={80} />}
          </Field>
        )}
        <Field label="Email" error={fields.email}>
          {(p) => <input {...p} className="input" name="email" type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} autoComplete="email" autoCapitalize="none" spellCheck={false} disabled={busy} required />}
        </Field>
        <Field label="Password" hint={signup ? 'At least 10 characters.' : undefined} error={fields.password}>
          {(p) => (
            <div className="auth-password"><input
              {...p}
              className="input"
              name="password"
              type={showPassword ? 'text' : 'password'}
              placeholder={signup ? 'Create a password' : 'Enter your password'}
              disabled={busy}
              value={form.password}
              onChange={set('password')}
              autoComplete={signup ? 'new-password' : 'current-password'}
              required
              minLength={signup ? 10 : undefined}
            /><button type="button" className="auth-password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)} disabled={busy}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{showPassword && <path d="m3 3 18 18" />}</svg>
            </button></div>
          )}
        </Field>
        <ErrorNotice error={error} />
        <button type="submit" className="auth-submit" disabled={busy}>
          <span aria-live="polite">{busy ? (signup ? 'Creating your account…' : 'Signing you in…') : signup ? 'Create your account' : 'Sign in to your studio'}</span>
          {busy ? <span className="auth-spinner" aria-hidden="true" /> : <span aria-hidden="true">↗</span>}
        </button>
      </form>
      <p className="auth-switch">
        {signup ? (
          <>
            Already have an account? <Link href="/login">Sign in</Link>
          </>
        ) : (
          <>
            New here? <Link href="/signup">Create an account</Link>
          </>
        )}
      </p>
      <div className="auth-form-note"><span aria-hidden="true">✧</span> {signup ? 'From inspiration to a script you can actually use.' : 'Pick up where inspiration left off.'}</div>
    </div>
  );
}
