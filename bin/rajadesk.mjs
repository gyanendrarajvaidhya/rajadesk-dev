#!/usr/bin/env node
// rajadesk --dev   start Raja Desk Dev and open it in the browser (keep the window open while you use it)
// rajadesk stop    stop it
// rajadesk --version / --help
import { exec } from "node:child_process";

const args = process.argv.slice(2);
const has = (...names) => names.some((n) => args.includes(n));
const portArg = args.find((a) => a.startsWith("--port="));
const PORT = Number(portArg?.split("=")[1] ?? process.env.RAJADESK_DEV_PORT ?? 4646);
const LINK = `http://127.0.0.1:${PORT}/`;
const open = () => { if (!has("--no-open")) exec(process.platform === "win32" ? `start "" "${LINK}"` : `open "${LINK}"`); };

async function ping() {
  try {
    const r = await fetch(`${LINK}api/ping`, { signal: AbortSignal.timeout(1500) });
    const j = await r.json();
    return j.app === "rajadesk-dev" ? j : null;
  } catch {
    return null;
  }
}

if (has("--help", "-h", "help")) {
  console.log(`Raja Desk Dev: your Raja epics, tasks, timers and GitHub in one place.

  rajadesk --dev      start it and open ${LINK}
  rajadesk stop       stop it
  rajadesk --version  show the installed version

Update: npm install -g --prefer-online https://github.com/gyanendrarajvaidhya/rajadesk-dev/archive/refs/heads/main.tar.gz`);
  process.exit(0);
}

if (has("--version", "-v", "version")) {
  const { VERSION } = await import("../server/index.mjs");
  console.log(VERSION);
  process.exit(0);
}

if (has("stop")) {
  const running = await ping();
  if (!running) {
    console.log("Raja Desk Dev isn't running.");
    process.exit(0);
  }
  const page = await fetch(LINK).then((r) => r.text());
  const token = page.match(/"([0-9a-f]{48})"/)?.[1];
  await fetch(`${LINK}api/shutdown`, { method: "POST", headers: { "x-raja-token": token ?? "" } }).catch(() => {});
  console.log("Stopped.");
  process.exit(0);
}

// Default (and --dev): start the server, or open the one that is already running.
const { start, VERSION } = await import("../server/index.mjs");
start({
  port: PORT,
  onListening: (link) => {
    console.log(`Raja Desk Dev ${VERSION} running at ${link}`);
    console.log("Keep this window open while you work. Ctrl+C (or `rajadesk stop`) stops it.");
    open();
  },
  onBusy: async () => {
    if (await ping()) {
      console.log(`Raja Desk Dev is already running. Opening ${LINK}`);
      open();
      process.exit(0);
    }
    console.error(`Port ${PORT} is used by another program. Try: rajadesk --dev --port=4647`);
    process.exit(1);
  },
});
