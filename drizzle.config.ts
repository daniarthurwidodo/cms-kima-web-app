import { defineConfig } from "drizzle-kit";

// Migrations and studio use a direct 5432 connection. The transaction-mode
// pooler used at runtime cannot run DDL reliably, so DIRECT_URL wins here and
// DATABASE_URL is only the fallback for setups without a separate pooler.
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!url) {
  throw new Error("DIRECT_URL (or DATABASE_URL) is required");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
