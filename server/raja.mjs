// The developer's Raja session: Supabase client signed in as them, refreshed in one place, plus the sign-in window.
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { clearSession, loadConfig, loadSession, saveSession } from "./store.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Thrown when there is no usable Raja session: the server answers 401 and the page shows the sign-in card. */
export class SignedOut extends Error {
  constructor(message = "Not signed in to Raja") {
    super(message);
    this.status = 401;
  }
}

const persist = (s) =>
  saveSession({
    access_token: s.access_token,
    refresh_token: s.refresh_token,
    expires_at: s.expires_at,
    user: { id: s.user?.id, email: s.user?.email },
  });

async function loadDirectory(sb) {
  const [devs, projects, roles] = await Promise.all([
    sb.from("developers").select("id,name,email,level,is_active,manager_id"),
    sb.from("projects").select("id,project_code,name,status,product_manager_id"),
    sb.from("user_roles").select("developer_id,role"),
  ]);
  for (const r of [devs, projects]) if (r.error) throw new Error(r.error.message);
  const rolesByDev = new Map();
  for (const r of roles.data ?? []) rolesByDev.set(r.developer_id, [...(rolesByDev.get(r.developer_id) ?? []), r.role]);
  return {
    devs: devs.data,
    projects: projects.data,
    devById: new Map(devs.data.map((d) => [d.id, d])),
    projById: new Map(projects.data.map((p) => [p.id, p])),
    rolesByDev,
  };
}

// Single-flight: the page fires many API calls at once and Supabase refresh tokens are one-time use, so parallel
// rebuilds would spend the same refresh token twice and get the session revoked.
let ctx = null;
let pending = null;

async function build() {
  const config = loadConfig();
  const session = loadSession();
  if (!config?.anonKey || !session?.refresh_token) throw new SignedOut();
  const sb = createClient(config.supabaseUrl, config.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
  if (error || !data.session) throw new SignedOut("Your Raja session expired. Sign in again.");
  if (data.session.refresh_token !== session.refresh_token) persist(data.session);
  const user = data.session.user;
  const dir = await loadDirectory(sb);
  const me = dir.devs.find((d) => d.email?.toLowerCase() === user.email.toLowerCase());
  if (!me) throw Object.assign(new Error(`${user.email} has no developer profile in Raja. Ask your PM to add you.`), { status: 403 });
  // Optional column: the GitHub handle Raja keeps for this developer (used to say whether the connected account matches).
  const gh = await sb.from("developers").select("github_username").eq("id", me.id).maybeSingle();
  me.github_username = gh.data?.github_username ?? null;
  // Expires 5 minutes before the access token does (or after 40 minutes, whichever is first).
  const until = Math.min((data.session.expires_at ?? 0) * 1000 - 5 * 60_000, Date.now() + 40 * 60_000);
  ctx = { sb, user, dir, me, refreshAt: until };
  return ctx;
}

export async function raja() {
  if (ctx && Date.now() < ctx.refreshAt) return ctx;
  pending ??= build().finally(() => { pending = null; });
  return pending;
}

export function forget() {
  ctx = null;
}

// ---------- sign-in window (login.mjs in a child process) ----------

let login = null; // { startedAt, child }
let lastLogin = null; // { ok, at, error }

/** "Cancel" on the sign-in card: closes the sign-in window (e.g. it never appeared) so the developer can try again. */
export function cancelLogin() {
  if (!login) return { cancelled: false };
  const { child } = login;
  login = null;
  lastLogin = { ok: false, at: Date.now(), error: "Sign-in cancelled." };
  if (process.platform === "win32") spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
  else child.kill();
  return { cancelled: true };
}

export function startLogin() {
  if (login) return { started: false, already: true };
  const child = spawn(process.execPath, [path.join(HERE, "login.mjs")], { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
  const entry = { startedAt: Date.now(), child };
  let stderr = "";
  child.stderr.on("data", (d) => { stderr += d; });
  const done = (code) => {
    if (login !== entry) return;
    login = null;
    lastLogin = { ok: code === 0, at: Date.now(), error: code === 0 ? null : stderr.trim().split("\n").pop() || `Sign-in did not finish (exit ${code}).` };
    ctx = null;
  };
  child.on("exit", done);
  child.on("error", (e) => { stderr += e.message; done(1); });
  login = entry;
  return { started: true };
}

export function signOut() {
  clearSession();
  ctx = null;
  lastLogin = null;
}

/** For the sign-in card: is a session saved, is the window open, how did the last attempt end. */
export async function status() {
  const s = loadSession();
  const out = { signedIn: false, signingIn: !!login, signingInSince: login?.startedAt ?? null, lastLogin, email: s?.user?.email ?? null, name: null, error: null };
  if (!s?.refresh_token || login) return out;
  try {
    const { me } = await raja();
    return { ...out, signedIn: true, name: me.name, devId: me.id, githubUsername: me.github_username };
  } catch (e) {
    return { ...out, error: e.status === 401 ? null : e.message, expired: e.status === 401 };
  }
}
