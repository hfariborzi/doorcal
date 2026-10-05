import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const neonDb = (url: string) => drizzleNeon(neon(url), { schema });
type Db = ReturnType<typeof neonDb>;

/** Neon's HTTP driver for Neon (fast on serverless); node-postgres for any other Postgres. */
export function usesNeonHttp(url: string) {
  const driver = process.env.DATABASE_DRIVER;
  if (driver) return driver === "neon";
  try {
    return new URL(url).hostname.endsWith(".neon.tech");
  } catch {
    return false;
  }
}

function createDb(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (usesNeonHttp(url)) return neonDb(url);
  // Same query API for everything this app uses, so it is typed as the Neon client.
  return drizzlePg(new Pool({ connectionString: url }), { schema }) as unknown as Db;
}

let _db: Db | undefined;

// Lazily connect so `next build` works without a database.
export const db = new Proxy({} as Db, {
  get(_, prop) {
    _db ??= createDb();
    return Reflect.get(_db, prop, _db);
  },
});

export * from "./schema";
