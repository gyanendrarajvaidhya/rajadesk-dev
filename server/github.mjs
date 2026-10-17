// GitHub as the developer, through a personal access token they paste on the GitHub card (saved only on their PC in
// ~/.rajadesk-dev/github.json). Read-only: pull requests, review requests and recent pushes.
import { clearGithub, loadGithub, saveGithub } from "./store.mjs";

const API = "https://api.github.com";
/** Where updates are published (private repo; the developer's own token must be able to read it). */
export const UPDATE_REPO = "gyanendrarajvaidhya/rajadesk-dev";
/** Classic token with the scopes this page needs, pre-filled on GitHub's "new token" page. */
export const NEW_TOKEN_URL = "https://github.com/settings/tokens/new?scopes=repo,read:org&description=Raja%20Desk%20Dev";

/** The token stopped working (expired, revoked): the page swaps the GitHub section for the "paste a new token" card. */
export class GithubSignedOut extends Error {
  constructor(message) {
    super(message);
    this.status = 409;
    this.code = "github_signed_out";
  }
}

let invalid = null; // message once GitHub has rejected the saved token

async function gh(path, token = loadGithub()?.token, { raw } = {}) {
  if (!token) throw new GithubSignedOut("GitHub isn't connected yet.");
  const res = await fetch(path.startsWith("http") ? path : `${API}${path}`, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: raw ? "application/vnd.github.raw+json" : "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "rajadesk-dev",
    },
  });
  if (res.status === 401) {
    invalid = "Your GitHub token stopped working (expired or revoked). Paste a new one.";
    throw new GithubSignedOut(invalid);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(`GitHub: ${body.message ?? `HTTP ${res.status}`}`), { status: res.status === 404 ? 404 : 502 });
  }
  return raw ? res.text() : res.json();
}

export function status() {
  const g = loadGithub();
  if (!g?.token) return { connected: false };
  return { connected: !invalid, login: g.login, name: g.name, avatar: g.avatar, scopes: g.scopes, savedAt: g.savedAt, error: invalid };
}

/** Checks the pasted token against GitHub before saving it. */
export async function connect(token) {
  const t = String(token ?? "").trim();
  if (!/^(ghp_|github_pat_|gho_)[A-Za-z0-9_]{20,}$/.test(t)) throw Object.assign(new Error("That doesn't look like a GitHub token (it starts with ghp_ or github_pat_)."), { status: 400 });
  const res = await fetch(`${API}/user`, { headers: { authorization: `Bearer ${t}`, accept: "application/vnd.github+json", "user-agent": "rajadesk-dev" } });
  if (res.status === 401) throw Object.assign(new Error("GitHub rejected that token. Check you copied all of it, or make a new one."), { status: 400 });
  if (!res.ok) throw Object.assign(new Error(`GitHub: HTTP ${res.status}`), { status: 502 });
  const user = await res.json();
  const scopes = (res.headers.get("x-oauth-scopes") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  saveGithub({ token: t, login: user.login, name: user.name, avatar: user.avatar_url, scopes, savedAt: new Date().toISOString() });
  invalid = null;
  cache = null;
  return { login: user.login, scopes };
}

export function disconnect() {
  clearGithub();
  invalid = null;
  cache = null;
}

let cache = null; // { at, data }
const TTL = 2 * 60 * 1000;

const prRow = (i) => ({
  url: i.html_url,
  number: i.number,
  title: i.title,
  repo: i.repository_url.replace(`${API}/repos/`, ""),
  draft: !!i.draft,
  author: i.user?.login,
  created_at: i.created_at,
  updated_at: i.updated_at,
  closed_at: i.closed_at,
  merged_at: i.pull_request?.merged_at ?? null,
  comments: i.comments,
});

/** Open PRs, PRs waiting on their review, PRs merged in the last 14 days, and pushes / PR activity from their event feed. */
export async function summary({ fresh = false } = {}) {
  if (!fresh && cache && Date.now() - cache.at < TTL) return cache.data;
  const g = loadGithub();
  if (!g?.token) throw new GithubSignedOut("GitHub isn't connected yet.");
  const q = (s) => `/search/issues?per_page=50&sort=updated&q=${encodeURIComponent(s)}`;
  const since = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);
  const [mine, reviews, merged, events] = await Promise.all([
    gh(q(`is:pr is:open author:${g.login} archived:false`)),
    gh(q(`is:pr is:open review-requested:${g.login} archived:false`)),
    gh(q(`is:pr is:merged author:${g.login} merged:>=${since}`)),
    gh(`/users/${g.login}/events?per_page=100`).catch(() => []),
  ]);
  const pushes = events.filter((e) => e.type === "PushEvent").map((e) => {
    const ref = String(e.payload?.ref ?? "").replace(/^refs\/heads\//, "");
    const commits = (e.payload?.commits ?? []).map((c) => ({ sha: c.sha, message: String(c.message ?? "").split("\n")[0] }));
    const head = e.payload?.head;
    return {
      id: e.id, repo: e.repo?.name, branch: ref, at: e.created_at,
      count: e.payload?.size ?? commits.length, commits,
      url: head ? `https://github.com/${e.repo?.name}/commit/${head}` : `https://github.com/${e.repo?.name}/tree/${ref}`,
    };
  });
  const data = {
    login: g.login,
    open: mine.items.map(prRow),
    reviews: reviews.items.map(prRow),
    merged: merged.items.map(prRow),
    pushes,
    fetched_at: new Date().toISOString(),
  };
  cache = { at: Date.now(), data };
  return data;
}

/** Newest version in the (public) update repo: its package.json on main, or null when it can't be read. No token needed. */
export async function latestVersion() {
  try {
    const res = await fetch(`https://raw.githubusercontent.com/${UPDATE_REPO}/main/package.json`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const text = await res.text();
    return JSON.parse(text).version ?? null;
  } catch {
    return null;
  }
}
