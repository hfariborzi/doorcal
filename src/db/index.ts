import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return drizzle(neon(url), { schema });
}

let _db: ReturnType<typeof createDb> | undefined;

// Lazily connect so `next build` works without a database.
export const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_, prop) {
    _db ??= createDb();
    return Reflect.get(_db, prop, _db);
  },
});

export * from "./schema";
