// Raja Desk Dev server. Binds to 127.0.0.1 only, serves the page (../public) and a small JSON API that reads and
// writes Raja and GitHub as the developer signed in on this PC. Writes need the per-run token injected into the page,
// and the Host header must be localhost (guards against other websites poking this server).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import * as rajaSession from "./raja.mjs";
import * as work from "./work.mjs";
import * as github from "./github.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const PUBLIC = path.join(ROOT, "public");
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version;
const TOKEN = crypto.randomBytes(24).toString("hex");
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon",
  ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf",
};

// ---------- version check (once an hour, from the public repo) ----------
let latest = { version: null, at: 0 };
async function update() {
  if (Date.now() - latest.at > 60 * 60 * 1000) {
    latest = { version: await github.latestVersion(), at: Date.now() };
  }
  const newer = latest.version && cmp(latest.version, VERSION) > 0;
  return {
    current: VERSION,
    latest: latest.version,
    available: !!newer,
    command: `npm install -g git+https://github.com/${github.UPDATE_REPO}.git`,
  };
}
const cmp = (a, b) => {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  return 0;
};

const bad = (msg) => Object.assign(new Error(msg), { status: 400 });

const GET_ROUTES = [
  [/^\/api\/ping$/, () => ({ app: "rajadesk-dev", version: VERSION, pid: process.pid })],
  [/^\/api\/status$/, async () => ({ raja: await rajaSession.status(), github: github.status(), update: await update(), newTokenUrl: github.NEW_TOKEN_URL })],
  [/^\/api\/work$/, () => work.work()],
  [/^\/api\/epic\/(EPIC-\d+)$/i, (m) => work.epicDetail(m[1])],
  [/^\/api\/github$/, (m, b, url) => github.summary({ fresh: url.searchParams.has("fresh") })],
];

const POST_ROUTES = [
  [/^\/api\/raja\/login$/, () => rajaSession.startLogin()],
  [/^\/api\/raja\/logout$/, () => rajaSession.signOut()],
  [/^\/api\/github\/token$/, (m, b) => github.connect(b.token)],
  [/^\/api\/github\/disconnect$/, () => github.disconnect()],
  [/^\/api\/task\/([0-9a-f-]{36})\/(play|pause|status|check)$/i, (m, b) => {
    if (m[2] === "play") return work.play(m[1]);
    if (m[2] === "pause") return work.pause(m[1]);
    if (m[2] === "status") return work.setTaskStatus(m[1], b.to, b.reason, b.prUrl);
    if (!b.itemId) throw bad("itemId is missing");
    return work.setChecklistItem(m[1], b.itemId, !!b.checked);
  }],
  [/^\/api\/epic\/(EPIC-\d+)\/(ack|review|comment|pr|task)$/i, (m, b) => {
    switch (m[2].toLowerCase()) {
      case "ack": return work.acknowledgeEpic(m[1]);
      case "review": return work.submitForReview(m[1]);
      case "comment": return work.commentEpic(m[1], b.text);
      case "pr": return work.addEpicPr(m[1], b.url);
      default: return work.createTask(m[1], b);
    }
  }],
  [/^\/api\/shutdown$/, () => { setTimeout(() => process.exit(0), 200); return { stopping: true }; }],
];

// ---------- http ----------
const json = (res, code, data) => {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(data));
};
async function readBody(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 100_000) throw bad("Body too large");
  }
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw bad("Body is not JSON");
  }
}

function serveStatic(pathname, res) {
  if (pathname !== "/" && pathname !== "/index.html" && pathname !== "/favicon.svg" && !pathname.startsWith("/assets/")) return false;
  let rel;
  try { rel = pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1)); }
  catch { rel = ""; }
  const file = path.resolve(PUBLIC, rel);
  if (!rel || !file.startsWith(PUBLIC + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end(rel === "index.html" ? "The page isn't built. Reinstall: npm install -g git+https://github.com/" + github.UPDATE_REPO + ".git" : "Not found");
    return true;
  }
  const ext = path.extname(file).toLowerCase();
  if (ext === ".html") {
    res.writeHead(200, { "content-type": MIME[".html"], "cache-control": "no-store" });
    res.end(fs.readFileSync(file, "utf8").replace("__RAJA_TOKEN__", TOKEN));
    return true;
  }
  res.writeHead(200, { "content-type": MIME[ext] ?? "application/octet-stream", "cache-control": rel.startsWith("assets/") ? "public, max-age=31536000, immutable" : "no-store" });
  res.end(fs.readFileSync(file));
  return true;
}

export function start({ port, onListening, onBusy }) {
  const server = http.createServer(async (req, res) => {
    const host = (req.headers.host ?? "").split(":")[0];
    if (!["127.0.0.1", "localhost"].includes(host)) return json(res, 403, { error: "local only" });
    const url = new URL(req.url, `http://${req.headers.host}`);
    try {
      if (req.method === "GET" && serveStatic(url.pathname, res)) return;
      const routes = req.method === "GET" ? GET_ROUTES : req.method === "POST" ? POST_ROUTES : [];
      if (req.method === "POST" && req.headers["x-raja-token"] !== TOKEN) return json(res, 403, { error: "This page is out of date. Reload it." });
      for (const [re, handler] of routes) {
        const m = url.pathname.match(re);
        if (!m) continue;
        const body = req.method === "POST" ? await readBody(req) : undefined;
        const result = await handler(m, body, url);
        return json(res, 200, req.method === "POST" ? { ok: true, ...(result ?? {}) } : result);
      }
      json(res, 404, { error: "not found" });
    } catch (err) {
      const status = Number.isInteger(err?.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
      json(res, status, { error: err?.message ?? String(err), ...(err?.code ? { code: err.code } : {}) });
    }
  });
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") return onBusy?.();
    throw err;
  });
  server.listen(port, "127.0.0.1", () => onListening?.(`http://127.0.0.1:${port}/`));
  return server;
}

export { VERSION };
