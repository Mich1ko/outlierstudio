import { eq } from 'drizzle-orm';
import { quote } from './ai/features/shared';
import { getDb } from './db/client';
import { users } from './db/schema';

export const PERSONA_MAX = 1500;

export async function getPersona(userId: string): Promise<string> {
  const db = await getDb();
  const [row] = await db.select({ persona: users.persona }).from(users).where(eq(users.id, userId)).limit(1);
  return row?.persona ?? '';
}

export async function setPersona(userId: string, persona: string): Promise<string> {
  const db = await getDb();
  const value = persona.trim().slice(0, PERSONA_MAX);
  await db.update(users).set({ persona: value || null }).where(eq(users.id, userId));
  return value;
}

/** The creator's profile as a prompt block, or an empty string when they have not written one. */
export async function personaBlock(userId: string): Promise<string> {
  const persona = await getPersona(userId);
  return persona ? quote('creator_profile', persona) : '';
}

export const PERSONA_RULE = 'If a creator profile is given, write for that creator: their niche, their audience and their way of speaking.';
