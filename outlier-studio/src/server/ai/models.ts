import { env } from '../env';

/**
 * Features ask for a tier, never a model id. The ids come from environment
 * variables, so a deprecated model is replaced by changing configuration.
 */
export type ModelTier = 'quality' | 'fast';

export function modelFor(tier: ModelTier): string {
  const e = env();
  return tier === 'quality' ? e.GROQ_MODEL_QUALITY : e.GROQ_MODEL_FAST;
}

export function transcriptionModel(): string {
  return env().GROQ_MODEL_TRANSCRIBE;
}

/** Whether the model accepts response_format json_schema with strict:true. */
export function supportsStrictJson(model: string): boolean {
  return env()
    .GROQ_STRICT_JSON_MODELS.split(',')
    .map((m) => m.trim())
    .includes(model);
}
