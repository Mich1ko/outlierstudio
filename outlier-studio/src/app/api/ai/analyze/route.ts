import { AnalysisInput, analyzeVideo } from '@/server/ai/features/analysis';
import { json, readJson, route } from '@/server/http';

export const runtime = 'nodejs';
export const maxDuration = 120;

export const POST = route('user', async ({ req, user }) => {
  const input = await readJson(req, AnalysisInput);
  return json(await analyzeVideo(user.id, input), { status: 201 });
});
