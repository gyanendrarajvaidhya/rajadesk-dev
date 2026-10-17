#!/usr/bin/env node
// Raja sign-in window, started by the "Sign in to Raja" button (never needs a terminal).
// Opens Chrome (or Edge when Chrome isn't installed) with a dedicated local profile on Raja's Katyayani SSO page,
// waits for the developer to sign in, then saves the Supabase session + public anon key to ~/.rajadesk-dev/.
// Exit codes: 0 signed in, 1 timed out / window closed, 2 no browser found.
import { chromium } from "playwright-core";
import { RAJA_ORIGIN, SUPABASE_URL, STORAGE_KEY, PROFILE_DIR, saveSession, saveConfig } from "./store.mjs";

const TIMEOUT_MS = 10 * 60 * 1000;

async function launch() {
  for (const channel of ["chrome", "msedge"]) {
    try {
      return await chromium.launchPersistentContext(PROFILE_DIR, { channel, headless: false, viewport: null });
    } catch {
      // not installed: try the next browser
    }
  }
  console.error("Neither Google Chrome nor Microsoft Edge could be opened. Install Chrome and try again.");
  process.exit(2);
}

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
await page.goto(`${RAJA_ORIGIN}/auth`).catch(() => {});

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
  console.error(closed ? "The sign-in window was closed before you signed in." : "Timed out waiting for sign-in (10 minutes).");
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
await ctx.close().catch(() => {});
process.exit(0);
