'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { APP } from '@/config/app';
import { api, type ApiError } from '@/lib/api';
import { ErrorNotice, Field } from './ui';

export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const signup = mode === 'signup';
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
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
    <div>
      <Link href="/" className="brand" style={{ justifySelf: 'start', paddingLeft: 0 }}>
        <span className="brand-mark" />
        {APP.name}
      </Link>
      <h1>{signup ? 'Create your account' : 'Sign in'}</h1>
      <form className="stack" onSubmit={submit} noValidate>
        {signup && (
          <Field label="Name" error={fields.name}>
            {(p) => <input {...p} className="input" value={form.name} onChange={set('name')} autoComplete="name" required maxLength={80} />}
          </Field>
        )}
        <Field label="Email" error={fields.email}>
          {(p) => <input {...p} className="input" type="email" value={form.email} onChange={set('email')} autoComplete="email" required />}
        </Field>
        <Field label="Password" hint={signup ? 'At least 10 characters.' : undefined} error={fields.password}>
          {(p) => (
            <input
              {...p}
              className="input"
              type="password"
              value={form.password}
              onChange={set('password')}
              autoComplete={signup ? 'new-password' : 'current-password'}
              required
              minLength={signup ? 10 : undefined}
            />
          )}
        </Field>
        <ErrorNotice error={error} />
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? (signup ? 'Creating account' : 'Signing in') : signup ? 'Create account' : 'Sign in'}
        </button>
      </form>
      <p className="muted">
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
    </div>
  );
}
