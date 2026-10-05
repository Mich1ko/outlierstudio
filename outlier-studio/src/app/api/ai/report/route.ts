import { ReportInput, writeChannelReport } from '@/server/ai/features/report';
import { json, readJson, route } from '@/server/http';

export const runtime = 'nodejs';
export const maxDuration = 120;

export const POST = route('user', async ({ req, user }) => {
  const { channelId } = await readJson(req, ReportInput);
  return json(await writeChannelReport(user.id, channelId), { status: 201 });
});
