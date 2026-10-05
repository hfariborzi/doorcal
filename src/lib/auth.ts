import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, users, type User } from "@/db";
import { SESSION_COOKIE, verifySession } from "./session";

export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies();
  const userId = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!userId) return null;
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return user ?? null;
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
