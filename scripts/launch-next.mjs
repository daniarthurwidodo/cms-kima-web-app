/**
 * Shared entrypoint for `npm run dev` and `npm start`.
 * Verifies which environment we are about to serve (local | staging | production)
 * and that its config is sane, then hands over to `next dev` / `next start`.
 * Refuses to boot on a mismatch, e.g. a "production" process pointed at a local
 * database, or a "local" one pointed at a remote database.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const MODE = { DEV: "dev", START: "start" };

const NEXT_ENTRY = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));

const APP_ENV = { LOCAL: "local", STAGING: "staging", PRODUCTION: "production" };
const ENVIRONMENTS = Object.values(APP_ENV);
const REQUIRED = [
  "DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
];
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "host.docker.internal"]);
const POOLER_PORT = "6543";

function runEnvironmentCheck({ mode }) {
  const errors = [];
  const warnings = [];

  const appEnv = process.env.APP_ENV?.trim();
  if (!appEnv) {
    errors.push(`APP_ENV is not set. Expected one of: ${ENVIRONMENTS.join(", ")}.`);
  } else if (!ENVIRONMENTS.includes(appEnv)) {
    errors.push(`APP_ENV="${appEnv}" is invalid. Expected one of: ${ENVIRONMENTS.join(", ")}.`);
  }

  if (mode === MODE.DEV && appEnv && appEnv !== APP_ENV.LOCAL) {
    errors.push(`npm run dev requires APP_ENV=${APP_ENV.LOCAL}, got "${appEnv}".`);
  }

  // NEXT_PUBLIC_* is inlined at `next build`, so a mismatch means the build was
  // made for a different environment than the one we are starting.
  const publicEnv = process.env.NEXT_PUBLIC_APP_ENV?.trim();
  if (appEnv && publicEnv !== appEnv) {
    const hint = mode === MODE.START ? "Rebuild with matching values." : "Make them match.";
    errors.push(`NEXT_PUBLIC_APP_ENV="${publicEnv ?? ""}" does not match APP_ENV="${appEnv}". ${hint}`);
  }

  for (const key of REQUIRED) {
    if (!process.env[key]?.trim()) errors.push(`${key} is required but not set.`);
  }

  const parseUrl = (key) => {
    const value = process.env[key]?.trim();
    if (!value) return null;
    try {
      return new URL(value);
    } catch {
      errors.push(`${key} is not a valid URL.`);
      return null;
    }
  };

  const db = parseUrl("DATABASE_URL");
  const supabase = parseUrl("NEXT_PUBLIC_SUPABASE_URL");
  const isLocalHost = (url) => LOCAL_HOSTS.has(url.hostname);

  if (ENVIRONMENTS.includes(appEnv)) {
    for (const [key, url] of [["DATABASE_URL", db], ["NEXT_PUBLIC_SUPABASE_URL", supabase]]) {
      if (!url) continue;
      if (appEnv === APP_ENV.LOCAL && !isLocalHost(url)) {
        errors.push(`APP_ENV=local but ${key} points at remote host "${url.hostname}".`);
      }
      if (appEnv !== APP_ENV.LOCAL && isLocalHost(url)) {
        errors.push(`APP_ENV=${appEnv} but ${key} points at local host "${url.hostname}".`);
      }
    }

    // Serverless on Vercel: must go through the transaction pooler.
    if (appEnv !== APP_ENV.LOCAL && db && !isLocalHost(db) && db.port !== POOLER_PORT) {
      errors.push(
        `DATABASE_URL must use the Supabase pooler (port ${POOLER_PORT}), got port "${db.port || "default"}".`,
      );
    }

    if (mode === MODE.START && appEnv !== APP_ENV.LOCAL && !existsSync(".next")) {
      warnings.push("No .next build found — run `npm run build` first.");
    }
  }

  const tag = `[${mode}]`;
  const label = appEnv ? appEnv.toUpperCase() : "UNKNOWN";
  console.log(`${tag} environment: ${label}`);
  if (db) console.log(`${tag} database:    ${db.hostname}:${db.port || "default"}`);
  if (supabase) console.log(`${tag} supabase:    ${supabase.origin}`);
  for (const warning of warnings) console.warn(`${tag} warning: ${warning}`);

  if (errors.length === 0) return;
  for (const error of errors) console.error(`${tag} error: ${error}`);
  console.error(`${tag} Refusing to start. Fix the environment configuration above.`);
  process.exit(1);
}

export function launchNext({ mode }) {
  runEnvironmentCheck({ mode });

  const child = spawn(process.execPath, [NEXT_ENTRY, mode, ...process.argv.slice(2)], {
    stdio: "inherit",
  });
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
  child.on("exit", (code) => process.exit(code ?? 1));
}
