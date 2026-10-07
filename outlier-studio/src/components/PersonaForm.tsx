'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { api, type ApiError } from '@/lib/api';
import { ErrorNotice, Field, Skeleton } from './ui';

const MAX = 1500;

/** The creator's own description of themselves. It is added to every hook and script request. */
export function PersonaForm() {
  const [persona, setPersona] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    api<{ persona: string }>('/api/profile')
      .then((r) => setPersona(r.persona))
      .catch(setError);
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    setState('saving');
    setError(null);
    try {
      const r = await api<{ persona: string }>('/api/profile', { method: 'PUT', body: { persona: persona ?? '' } });
      setPersona(r.persona);
      setState('saved');
    } catch (err) {
      setError(err as ApiError);
      setState('idle');
    }
  }

  if (persona === null) return error ? <ErrorNotice error={error} /> : <Skeleton />;
  return (
    <form className="stack" onSubmit={save}>
      <Field label="About you" optional hint={`Your niche, who watches you, and how you talk. Used whenever hooks or scripts are written for you. ${persona.length} of ${MAX} characters.`}>
        {(p) => (
          <textarea
            {...p}
            className="textarea"
            value={persona}
            onChange={(e) => {
              setPersona(e.target.value);
              setState('idle');
            }}
            maxLength={MAX}
            placeholder="I coach beginner runners over 40. My viewers are busy and a bit sceptical. I talk plainly, with dry humour, and never shout."
          />
        )}
      </Field>
      <ErrorNotice error={error} />
      <div className="row">
        <button className="btn btn-primary" disabled={state === 'saving'}>
          {state === 'saving' ? 'Saving profile' : 'Save profile'}
        </button>
        <span role="status" className="muted small">
          {state === 'saved' ? 'Profile saved.' : ''}
        </span>
      </div>
    </form>
  );
}
