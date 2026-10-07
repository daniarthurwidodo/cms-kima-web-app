#!/usr/bin/env node
/** `npm start` entrypoint: environment check, then `next start`. */
import { existsSync } from "node:fs";
import { launchNext, MODE } from "./launch-next.mjs";

// Same precedence idea as `next start`: real env vars win, .env.local fills gaps.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

launchNext({ mode: MODE.START });
