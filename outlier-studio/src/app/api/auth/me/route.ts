import { json, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route('user', async ({ user }) => json({ user }));
