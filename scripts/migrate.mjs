// Applies pending SQL migrations from ./drizzle. Runs automatically before `next build`.
// Skips quietly when DATABASE_URL is not set (e.g. CI builds without a database).
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

if (!process.env.DATABASE_URL) {
  console.log("[migrate] DATABASE_URL not set, skipping migrations");
  process.exit(0);
}

const db = drizzle(neon(process.env.DATABASE_URL));
await migrate(db, { migrationsFolder: "./drizzle" });
console.log("[migrate] database is up to date");
