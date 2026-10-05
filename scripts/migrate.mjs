// Applies pending SQL migrations from ./drizzle. Runs automatically before `next build`.
// Skips quietly when DATABASE_URL is not set (e.g. CI builds without a database).
// Skips Vercel preview builds, which often share the production database, unless MIGRATE_PREVIEWS=true
// (set that if each preview gets its own database branch).
// Uses Neon's HTTP driver for Neon URLs and node-postgres for any other Postgres (see src/db/index.ts).

const url = process.env.DATABASE_URL;

if (!url) {
  console.log("[migrate] DATABASE_URL not set, skipping migrations");
  process.exit(0);
}

if (process.env.VERCEL_ENV === "preview" && process.env.MIGRATE_PREVIEWS !== "true") {
  console.log("[migrate] preview build, skipping migrations (set MIGRATE_PREVIEWS=true to run them)");
  process.exit(0);
}

function usesNeonHttp() {
  if (process.env.DATABASE_DRIVER) return process.env.DATABASE_DRIVER === "neon";
  try {
    return new URL(url).hostname.endsWith(".neon.tech");
  } catch {
    return false;
  }
}

if (usesNeonHttp()) {
  const { neon } = await import("@neondatabase/serverless");
  const { drizzle } = await import("drizzle-orm/neon-http");
  const { migrate } = await import("drizzle-orm/neon-http/migrator");
  await migrate(drizzle(neon(url)), { migrationsFolder: "./drizzle" });
} else {
  const { Pool } = (await import("pg")).default;
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");
  const pool = new Pool({ connectionString: url });
  try {
    await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  } finally {
    await pool.end();
  }
}
console.log("[migrate] database is up to date");
