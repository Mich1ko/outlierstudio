import { route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route('user', async ({ req }) => {
  const raw = new URL(req.url).searchParams.get('url') ?? '';
  let source: URL;
  try {
    source = new URL(raw);
  } catch {
    return new Response(null, { status: 400 });
  }
  const host = source.hostname.toLowerCase();
  if (source.protocol !== 'https:' || !(host.endsWith('.cdninstagram.com') || host.endsWith('.fbcdn.net'))) {
    return new Response(null, { status: 400 });
  }
  try {
    const image = await fetch(source, { redirect: 'error', signal: AbortSignal.timeout(8_000) });
    if (!image.ok || !image.headers.get('content-type')?.startsWith('image/')) return new Response(null, { status: 404 });
    if (Number(image.headers.get('content-length') ?? 0) > 2_000_000) return new Response(null, { status: 413 });
    const bytes = await image.arrayBuffer();
    if (bytes.byteLength > 2_000_000) return new Response(null, { status: 413 });
    return new Response(bytes, { headers: { 'content-type': image.headers.get('content-type')!, 'cache-control': 'private, max-age=3600' } });
  } catch {
    return new Response(null, { status: 404 });
  }
});
