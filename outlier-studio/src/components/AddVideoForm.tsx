'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { api, type ApiError } from '@/lib/api';
import { parseVideoLink } from '@/shared/video-url';
import { ErrorNotice, Field } from './ui';
import { PlatformLogo } from './PlatformLogo';

/**
 * Paste one video link (YouTube, TikTok or Instagram). The video is added to
 * the user's list and its page opens; with analyze set, the breakdown starts
 * there straight away.
 */
export function AddVideoForm({ analyze = false, label = 'Video link', button = 'Add video' }: { analyze?: boolean; label?: string; button?: string }) {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [linkError, setLinkError] = useState<string | undefined>();
  const [error, setError] = useState<ApiError | null>(null);
  const detected = parseVideoLink(url);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = parseVideoLink(url);
    if (!parsed.ok) {
      setLinkError(parsed.reason);
      return;
    }
    setLinkError(undefined);
    setBusy(true);
    try {
      const { videoId } = await api<{ videoId: string }>('/api/videos', { body: { url } });
      router.push(`/app/videos/${videoId}${analyze ? '?analyze=1' : ''}`);
    } catch (err) {
      setError(err as ApiError);
      setBusy(false);
    }
  }

  return (
    <form className="stack link-analyzer" onSubmit={submit} noValidate>
      <div className="platform-lights" aria-label="Supported platforms">
        {(['youtube', 'tiktok', 'instagram'] as const).map((platform) => <span key={platform} data-active={detected.ok && detected.platform === platform}><PlatformLogo platform={platform} />{platform[0]!.toUpperCase() + platform.slice(1)}</span>)}
      </div>
      <div className="add-row">
        <Field label={label} hint="A YouTube video or Short, a TikTok video, or an Instagram reel." error={linkError}>
          {(p) => (
            <input
              {...p}
              className="input"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setLinkError(undefined);
              }}
              placeholder="Paste a YouTube, TikTok or Instagram link"
              maxLength={500}
              inputMode="url"
            />
          )}
        </Field>
        <button className="btn btn-primary" disabled={busy || url.trim().length < 8}>
          {busy ? 'Reading the video' : button}
        </button>
      </div>
      <ErrorNotice error={error} />
    </form>
  );
}
