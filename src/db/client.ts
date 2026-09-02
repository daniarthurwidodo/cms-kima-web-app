import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

// ponytail: single global postgres client. Supabase transaction-mode pooler
// requires prepare:false. Upgrade to per-request client only if connection
// saturation shows up in prod.
const queryClient = postgres(process.env.DATABASE_URL, { prepare: false });

export const db = drizzle(queryClient, { schema });
export type DB = typeof db;
