// Root schema aggregator.
// Each feature owns its own schema file under src/features/<feature>/data/schema.ts
// and re-exports here so drizzle-kit sees every table for migrations.
//
// Example:
//   export * from "@/src/features/auth/data/schema";
//   export * from "@/src/features/config-filter/data/schema";
export {};
