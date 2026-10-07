import 'server-only';
import { z } from 'zod';
import { HOOK_PATTERNS } from '@/shared/catalog';
import { AppError } from '../../errors';
import { saveGeneration } from '../../generations';
import { PERSONA_RULE, personaBlock } from '../../profile';
import { generateJson } from '../service';
import { DATA_RULE, PLATFORMS, quote, transcriptField } from './shared';

export { HOOK_PATTERNS };

export const HooksInput = z.object({
  topic: z.string().trim().min(3).max(300),
  audience: z.string().trim().max(200).optional(),
  tone: z.string().trim().max(60).optional(),
  platform: z.enum(PLATFORMS).optional(),
  count: z.number().int().min(3).max(20).default(10),
  /** Optional transcript of a video whose hook style should be adapted. */
  referenceTranscript: transcriptField.optional(),
});
export type HooksInput = z.infer<typeof HooksInput>;

const Output = z.object({
  hooks: z.array(
    z.object({
      text: z.string(),
      pattern: z.enum(HOOK_PATTERNS),
      why: z.string(),
    }),
  ),
});

const SYSTEM = `You write opening hooks for short-form vertical video (TikTok, Instagram Reels, YouTube Shorts).
A hook is the first line spoken on camera. It must earn the next three seconds.

Rules:
- One sentence, at most 18 words, in plain spoken language.
- Specific to the topic and audience given. No generic lines that would fit any video.
- Spread the hooks across different patterns; do not repeat one pattern more than three times.
- Never invent statistics, studies, quotes or personal results. If a number is not in the input, do not use one.
- "why" is one short sentence on the viewer psychology the hook relies on.
- If a reference transcript is given, borrow its hook structure and rhythm, not its wording or its claims.
- ${PERSONA_RULE}
${DATA_RULE}`;

export async function generateHooks(userId: string, input: HooksInput) {
  const lines = [
    `Write ${input.count} hooks.`,
    quote('topic', input.topic),
    input.audience ? quote('audience', input.audience) : '',
    input.tone ? quote('tone', input.tone) : '',
    input.platform ? `Platform: ${input.platform}` : '',
    input.referenceTranscript ? quote('reference_transcript', input.referenceTranscript) : '',
    await personaBlock(userId),
  ];
  const result = await generateJson({
    userId,
    feature: 'hooks',
    tier: 'quality',
    system: SYSTEM,
    prompt: lines.filter(Boolean).join('\n\n'),
    schemaName: 'hooks',
    schema: Output,
    temperature: 0.9,
  });

  const hooks = result.data.hooks
    .map((h) => ({ ...h, text: h.text.trim() }))
    .filter((h) => h.text.length > 0)
    .slice(0, input.count);
  if (hooks.length === 0) throw new AppError(502, 'ai_invalid_output', 'The AI returned no hooks. Please try again.');

  const generation = await saveGeneration({
    userId,
    kind: 'hooks',
    title: input.topic,
    input,
    output: { hooks },
    requestId: result.requestId,
  });
  return { generation, usage: result.usage, requestId: result.requestId };
}
