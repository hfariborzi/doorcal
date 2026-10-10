/** Daily limits for Dori, per user and for the whole instance, so a loop or a flood can't run up a bill. */
import { and, eq, sql } from "drizzle-orm";
import { db, aiUsage } from "@/db";

const USER_TURNS = Number(process.env.DORI_MAX_TURNS_PER_USER_PER_DAY) || 100;
const INSTANCE_TURNS = Number(process.env.DORI_MAX_TURNS_PER_DAY) || 5000;
const USER_VOICE_SECONDS = Number(process.env.DORI_MAX_VOICE_SECONDS_PER_USER_PER_DAY) || 1800;

const today = () => new Date().toISOString().slice(0, 10);

export async function doriRoomLeft(userId: number): Promise<boolean> {
  const day = today();
  const [mine] = await db.select({ turns: aiUsage.doriTurns }).from(aiUsage).where(and(eq(aiUsage.userId, userId), eq(aiUsage.day, day)));
  const [all] = await db.select({ turns: sql<number>`coalesce(sum(${aiUsage.doriTurns}), 0)` }).from(aiUsage).where(eq(aiUsage.day, day));
  return (mine?.turns ?? 0) < USER_TURNS && Number(all?.turns ?? 0) < INSTANCE_TURNS;
}

export async function voiceRoomLeft(userId: number): Promise<boolean> {
  const [mine] = await db.select({ s: aiUsage.voiceSeconds }).from(aiUsage).where(and(eq(aiUsage.userId, userId), eq(aiUsage.day, today())));
  return (mine?.s ?? 0) < USER_VOICE_SECONDS;
}

export async function recordDori(userId: number, add: { turns?: number; requests?: number; inputTokens?: number; outputTokens?: number; voiceSeconds?: number }) {
  const v = { turns: add.turns ?? 0, requests: add.requests ?? 0, inputTokens: add.inputTokens ?? 0, outputTokens: add.outputTokens ?? 0, voiceSeconds: Math.round(add.voiceSeconds ?? 0) };
  await db
    .insert(aiUsage)
    .values({ userId, day: today(), doriTurns: v.turns, requests: v.requests, inputTokens: v.inputTokens, outputTokens: v.outputTokens, voiceSeconds: v.voiceSeconds })
    .onConflictDoUpdate({
      target: [aiUsage.userId, aiUsage.day],
      set: {
        doriTurns: sql`${aiUsage.doriTurns} + ${v.turns}`,
        requests: sql`${aiUsage.requests} + ${v.requests}`,
        inputTokens: sql`${aiUsage.inputTokens} + ${v.inputTokens}`,
        outputTokens: sql`${aiUsage.outputTokens} + ${v.outputTokens}`,
        voiceSeconds: sql`${aiUsage.voiceSeconds} + ${v.voiceSeconds}`,
      },
    });
}
