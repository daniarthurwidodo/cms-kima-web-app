#!/usr/bin/env node
/** `npm run dev` entrypoint: environment check, then `next dev`. */
import { existsSync } from "node:fs";
import { launchNext, MODE } from "./launch-next.mjs";

// Same precedence as `next dev`: real env vars win, then .env.local, then .env.
for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

launchNext({ mode: MODE.DEV });
