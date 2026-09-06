#!/usr/bin/env node
/**
 * Runs the Supabase CLI against Podman.
 *
 * The CLI talks the Docker Engine API and only looks at DOCKER_HOST, so all we
 * do is point it at Podman's socket before handing over. Falls back to whatever
 * DOCKER_HOST is already set (or plain Docker) when Podman isn't present.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Runs `podman <args>`, returning trimmed stdout or null if podman is absent/failed. */
const run = (args) => {
  const r = spawnSync("podman", args, { encoding: "utf8" });
  return r.error || r.status !== 0 ? null : r.stdout.trim();
};

const podmanHost = () => {
  if (process.platform === "win32") {
    // Podman Desktop / `podman machine` exposes a named pipe named after the machine.
    const machine = run(["machine", "list", "--format", "{{.Name}}", "--noheading"]);
    if (!machine) return null;

    const name = machine.split(/\r?\n/)[0]?.replace(/\*$/, "").trim();
    return name ? `npipe:////./pipe/${name}` : null;
  }

  // Linux/macOS: rootless socket path reported by podman itself.
  const path = run(["info", "--format", "{{.Host.RemoteSocket.Path}}"]);
  return path && existsSync(path) ? `unix://${path}` : null;
};

const host = process.env.DOCKER_HOST ?? podmanHost();
if (host) process.env.DOCKER_HOST = host;

// Run the CLI's JS entrypoint under the current Node rather than the .bin
// shim: Windows refuses to spawn a .cmd without a shell.
const entry = fileURLToPath(
  new URL("../node_modules/supabase/dist/supabase.js", import.meta.url),
);

if (!existsSync(entry)) {
  console.error("supabase CLI not found — run your package manager's install first.");
  process.exit(1);
}

const child = spawn(process.execPath, [entry, ...process.argv.slice(2)], {
  stdio: "inherit",
});
child.on("exit", (code) => process.exit(code ?? 1));
