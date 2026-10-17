// Local storage for this developer's own sessions. Lives in %USERPROFILE%\.rajadesk-dev (separate from Gyan's ~/.raja,
// so the two never spend each other's one-time refresh tokens). Never print these values.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const RAJA_ORIGIN = "https://raja.ko-tech.in";
export const SUPABASE_REF = "fnzcpnkttjtzxivcjojy";
export const SUPABASE_URL = `https://${SUPABASE_REF}.supabase.co`;
export const STORAGE_KEY = `sb-${SUPABASE_REF}-auth-token`;

export const HOME_DIR = process.env.RAJADESK_DEV_HOME || path.join(os.homedir(), ".rajadesk-dev");
export const PROFILE_DIR = path.join(HOME_DIR, "browser-profile");
const SESSION_FILE = path.join(HOME_DIR, "session.json");
const CONFIG_FILE = path.join(HOME_DIR, "config.json");
const GITHUB_FILE = path.join(HOME_DIR, "github.json");

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(HOME_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), { mode: 0o600 });
}

const remove = (file) => fs.rmSync(file, { force: true });

export const loadSession = () => readJson(SESSION_FILE);
export const saveSession = (s) => writeJson(SESSION_FILE, s);
export const clearSession = () => remove(SESSION_FILE);
export const loadConfig = () => readJson(CONFIG_FILE);
export const saveConfig = (c) => writeJson(CONFIG_FILE, c);
export const loadGithub = () => readJson(GITHUB_FILE);
export const saveGithub = (g) => writeJson(GITHUB_FILE, g);
export const clearGithub = () => remove(GITHUB_FILE);
