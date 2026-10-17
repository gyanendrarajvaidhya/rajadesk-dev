// "Update now" button: runs the same npm install the developer would type, then restarts Raja Desk Dev in a new window
// and closes this one. The page waits for the new version to answer and reloads itself.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { HOME_DIR } from "./store.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOG = path.join(HOME_DIR, "update.log");
export const TARBALL = "https://github.com/gyanendrarajvaidhya/rajadesk-dev/archive/refs/heads/main.tar.gz";
export const COMMAND = `npm install -g --prefer-online ${TARBALL}`;

/**
 * The npm prefix this copy was installed into (<prefix>\node_modules\rajadesk-dev on Windows, <prefix>/lib/node_modules/… elsewhere),
 * so the update lands where this copy runs from even if npm's default prefix differs. Null when not a global install.
 */
function installPrefix() {
  const parent = path.dirname(ROOT);
  if (path.basename(parent).toLowerCase() !== "node_modules") return null;
  const up = path.dirname(parent);
  return process.platform !== "win32" && path.basename(up) === "lib" ? path.dirname(up) : up;
}
const installCommand = () => {
  const prefix = installPrefix();
  return prefix ? `npm install -g --prefer-online --prefix "${prefix}" ${TARBALL}` : COMMAND;
};

/** A git checkout (Gyan's source copy) updates with git pull, not npm. */
export const isSourceCopy = () => fs.existsSync(path.join(ROOT, ".git"));

let state = { state: "idle", error: null, startedAt: null };
/** pid: the page waits for a different pid to answer /api/ping, which also works when reinstalling the same version. */
export const status = () => ({ ...state, sourceCopy: isSourceCopy(), pid: process.pid });

export function start({ port }) {
  if (isSourceCopy()) throw Object.assign(new Error("This is a source copy (git). Update it with git pull."), { status: 400 });
  if (state.state === "installing" || state.state === "restarting") return status();
  state = { state: "installing", error: null, startedAt: Date.now() };
  fs.mkdirSync(HOME_DIR, { recursive: true });
  const out = fs.openSync(LOG, "w");
  const cmd = installCommand();
  fs.writeSync(out, `> ${cmd}\n`);
  const child = spawn(cmd, { shell: true, windowsHide: true, stdio: ["ignore", out, out] });
  child.on("error", (e) => { state = { ...state, state: "failed", error: e.message }; });
  child.on("exit", (code) => {
    fs.closeSync(out);
    if (code !== 0) {
      const tail = fs.readFileSync(LOG, "utf8").trim().split("\n").filter((l) => /err/i.test(l)).slice(-2).join(" ");
      state = { ...state, state: "failed", error: `npm install failed (exit ${code}). ${tail || `See ${LOG}`}` };
      return;
    }
    state = { ...state, state: "restarting" };
    restart(port);
  });
  return status();
}

/**
 * Opens a new "Raja Desk Dev" console window running the freshly installed copy, then exits this server. The new window
 * waits 2 s so this one has released the port. A small .cmd file avoids cmd.exe quoting trouble with spaces in paths.
 */
function restart(port) {
  const bin = path.join(ROOT, "bin", "rajadesk.mjs");
  if (process.platform !== "win32") {
    spawn(process.execPath, [bin, "--dev", "--no-open", `--port=${port}`], { detached: true, stdio: "ignore" }).unref();
  } else {
    const file = path.join(HOME_DIR, "restart.cmd");
    fs.writeFileSync(file, [
      "@echo off",
      "title Raja Desk Dev",
      "timeout /t 2 /nobreak >nul",
      `"${process.execPath}" "${bin}" --dev --no-open --port=${port}`,
      "",
    ].join("\r\n"));
    spawn("cmd.exe", ["/c", "start", "Raja Desk Dev", "cmd", "/k", file], { detached: true, stdio: "ignore", windowsHide: true }).unref();
  }
  setTimeout(() => process.exit(0), 500);
}
