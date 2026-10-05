import { json, route } from '@/server/http';
import { listHookLibrary } from '@/server/video/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route('user', async ({ user }) => json({ items: await listHookLibrary(user.id) }));
