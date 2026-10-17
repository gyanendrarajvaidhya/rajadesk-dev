#!/usr/bin/env node
// Raja sign-in window, started by the "Sign in to Raja" button (or `rajadesk login` in a terminal).
// Opens Chrome (or Edge) with a dedicated local profile on Raja's Katyayani SSO page, waits for the developer to sign in,
// then saves the Supabase session + public anon key to ~/.rajadesk-dev/. Every attempt is logged to ~/.rajadesk-dev/login.log.
// Exit codes: 0 signed in, 1 timed out / window closed, 2 no browser could be opened.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { HOME_DIR, RAJA_ORIGIN, SUPABASE_URL, STORAGE_KEY, PROFILE_DIR, saveSession, saveConfig } from "./store.mjs";

const TIMEOUT_MS = 10 * 60 * 1000;
const LOG = path.join(HOME_DIR, "login.log");
fs.mkdirSync(HOME_DIR, { recursive: true });
const log = (msg) => {
  try {
    fs.appendFileSync(LOG, `${new Date().toISOString()} ${msg}\n`);
  } catch {
    // logging must never stop the sign-in
  }
};
const say = (msg) => {
  console.error(msg); // the server shows the last stderr line on the sign-in card
  log(msg);
};

/** Browsers to try, in order: installed Chrome (per-user or machine-wide), then Edge. Playwright's own lookup goes last. */
function candidates() {
  const env = process.env;
  const roots = [env.LOCALAPPDATA, env.PROGRAMFILES, env["PROGRAMFILES(X86)"], env.ProgramW6432].filter(Boolean);
  const files = [
    ...roots.map((r) => ({ name: "Chrome", exe: path.join(r, "Google", "Chrome", "Application", "chrome.exe") })),
    ...roots.map((r) => ({ name: "Edge", exe: path.join(r, "Microsoft", "Edge", "Application", "msedge.exe") })),
  ];
  const seen = new Set();
  const found = files.filter((f) => !seen.has(f.exe.toLowerCase()) && seen.add(f.exe.toLowerCase()) && fs.existsSync(f.exe));
  return [...found, { name: "Chrome (auto)", channel: "chrome" }, { name: "Edge (auto)", channel: "msedge" }];
}

const firstLine = (e) => String(e?.message ?? e).split("\n").find((l) => l.trim()) ?? "unknown error";

async function launch() {
  const errors = [];
  for (const c of candidates()) {
    // A profile still locked by an earlier sign-in window: retry once with a fresh profile folder.
    for (const dir of [PROFILE_DIR, `${PROFILE_DIR}-${Date.now()}`]) {
      try {
        log(`launch ${c.name} ${c.exe ?? c.channel} profile=${dir}`);
        const ctx = await chromium.launchPersistentContext(dir, {
          ...(c.exe ? { executablePath: c.exe } : { channel: c.channel }),
          headless: false,
          viewport: null,
          timeout: 45_000,
          args: ["--no-first-run", "--no-default-browser-check"],
        });
        log(`opened ${c.name}`);
        return ctx;
      } catch (e) {
        const msg = firstLine(e);
        log(`failed ${c.name}: ${String(e?.message ?? e).slice(0, 2000)}`);
        errors.push(`${c.name}: ${msg}`);
        if (!/already in use|ProcessSingleton|lock/i.test(String(e?.message))) break; // only a locked profile is worth a second try
      }
    }
  }
  say(`Couldn't open a browser window. ${errors[0] ?? "Chrome / Edge not found."} (details: ${LOG})`);
  process.exit(2);
}

log("---- sign-in started");
const ctx = await launch();
let closed = false;
ctx.on("close", () => { closed = true; });

let anonKey = null;
ctx.on("request", (req) => {
  if (!anonKey && req.url().startsWith(SUPABASE_URL)) {
    const key = req.headers()["apikey"];
    if (key) anonKey = key;
  }
});

const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.goto(`${RAJA_ORIGIN}/auth`).catch((e) => log(`goto failed: ${firstLine(e)}`));
await page.bringToFront().catch(() => {});

// The profile can still hold an old session whose refresh token was already spent. Only accept a session whose access
// token is unexpired AND that Supabase confirms is live (GET /auth/v1/user does not spend the refresh token).
async function isLive(s) {
  if (!s?.expires_at || s.expires_at * 1000 < Date.now() + 60_000) return false;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${s.access_token}` },
  });
  return res.ok;
}

const started = Date.now();
let session = null;
while (!closed && Date.now() - started < TIMEOUT_MS) {
  try {
    const raw = await page.evaluate((k) => window.localStorage.getItem(k), STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const s = parsed.currentSession ?? parsed;
      if (s?.access_token && s?.refresh_token && anonKey && (await isLive(s))) {
        session = s;
        break;
      }
    }
  } catch {
    // page navigating during SSO redirects: keep polling
  }
  await new Promise((r) => setTimeout(r, 1500));
}

if (!session) {
  say(closed ? "The sign-in window was closed before you signed in." : "Timed out waiting for sign-in (10 minutes).");
  await ctx.close().catch(() => {});
  process.exit(1);
}

saveConfig({ supabaseUrl: SUPABASE_URL, anonKey });
saveSession({
  access_token: session.access_token,
  refresh_token: session.refresh_token,
  expires_at: session.expires_at,
  user: { id: session.user?.id, email: session.user?.email },
});
log(`signed in as ${session.user?.email}`);
console.log(`Signed in to Raja as ${session.user?.email}.`);
await ctx.close().catch(() => {});
process.exit(0);
