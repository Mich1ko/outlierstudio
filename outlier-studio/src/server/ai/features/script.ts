import 'server-only';
import { z } from 'zod';
import { FRAMEWORKS, FRAMEWORK_KEYS, WORDS_PER_SECOND } from '@/shared/catalog';
import { saveGeneration } from '../../generations';
import { PERSONA_RULE, personaBlock } from '../../profile';
import { openTextStream } from '../service';
import { DATA_RULE, PLATFORMS, quote, transcriptField } from './shared';

export const ScriptInput = z.object({
  /** What the video is about. Optional when a draft is supplied. */
  idea: z.string().trim().max(1000).default(''),
  /** The user's own draft to improve, instead of writing from nothing. */
  draft: z.string().trim().min(40, 'The draft is too short to work with.').max(6000).optional(),
  hook: z.string().trim().max(300).optional(),
  framework: z.enum(FRAMEWORK_KEYS).default('problem_solution'),
  lengthSeconds: z.number().int().min(15).max(180).default(45),
  tone: z.string().trim().max(60).optional(),
  audience: z.string().trim().max(200).optional(),
  platform: z.enum(PLATFORMS).optional(),
  callToAction: z.string().trim().max(200).optional(),
  /** Optional transcript of a video whose structure should be remixed. */
  referenceTranscript: transcriptField.optional(),
}).refine((v) => v.idea.length >= 5 || v.draft !== undefined, { path: ['idea'], message: 'Say what the video is about, in at least a few words.' });
export type ScriptInput = z.infer<typeof ScriptInput>;

const SYSTEM = `You write scripts for short-form vertical video, meant to be read aloud to camera.

Output format, in exactly this order, using these headings:
HOOK
(the opening line)

BODY
(the script, one short spoken sentence per line)

CALL TO ACTION
(one closing line)

Rules:
- Write for the ear: short sentences, everyday words, no stage directions, no emojis, no hashtags.
- Aim for the requested length at about ${WORDS_PER_SECOND} spoken words per second.
- Open a question early and pay it off late, so there is a reason to keep watching.
- Never invent statistics, studies, quotes or personal results that are not in the input.
- If a reference transcript is given, reuse its structure and pacing only. The words, examples and claims must be new.
- If a hook is provided, use it as written.
- If a draft is given, improve that draft instead of starting over: keep its idea, its facts and the speaker's voice; fix the opening line, cut what drags, and reorder it to fit the structure.
- ${PERSONA_RULE}
${DATA_RULE}`;

function prompt(input: ScriptInput, persona: string): string {
  return [
    `${input.draft ? 'Improve the draft into' : 'Write'} a ${input.lengthSeconds}-second script (about ${Math.round(input.lengthSeconds * WORDS_PER_SECOND)} words).`,
    `Structure: ${FRAMEWORKS[input.framework].label} - ${FRAMEWORKS[input.framework].guide}`,
    input.idea ? quote('idea', input.idea) : '',
    input.draft ? quote('draft', input.draft) : '',
    input.hook ? quote('hook', input.hook) : '',
    input.audience ? quote('audience', input.audience) : '',
    input.tone ? quote('tone', input.tone) : '',
    input.platform ? `Platform: ${input.platform}` : '',
    input.callToAction ? quote('call_to_action', input.callToAction) : '',
    input.referenceTranscript ? quote('reference_transcript', input.referenceTranscript) : '',
    persona,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export async function openScriptStream(userId: string, input: ScriptInput, signal?: AbortSignal) {
  return openTextStream({
    userId,
    feature: 'script',
    tier: 'quality',
    system: SYSTEM,
    prompt: prompt(input, await personaBlock(userId)),
    temperature: 0.8,
    signal,
  });
}

export function saveScript(userId: string, input: ScriptInput, text: string, requestId: string) {
  const title = input.idea || (input.draft ?? '').split('\n')[0] || 'Script';
  return saveGeneration({ userId, kind: 'script', title, input, output: { text }, requestId });
}
