import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { dataDir, ensureDir } from "./paths.js";
import type { DetectedApp, PersistedData, ScanState } from "./types.js";
import { runScan } from "./scanner.js";

const DATA_FILE = () => path.join(dataDir(), "apps.json");

export async function loadData(): Promise<PersistedData> {
  try {
    const raw = await fs.readFile(DATA_FILE(), "utf8");
    const parsed = JSON.parse(raw) as PersistedData;
    if (!Array.isArray(parsed.apps)) throw new Error("bad shape");
    return {
      version: parsed.version ?? 1,
      apps: parsed.apps,
      lastScanAt: parsed.lastScanAt ?? null,
      scanCount: parsed.scanCount ?? 0,
    };
  } catch {
    return { version: 1, apps: [], lastScanAt: null, scanCount: 0 };
  }
}

/** Atomic write: temp file in the same dir, fsync, then rename over the target. */
export async function saveData(data: PersistedData): Promise<void> {
  await ensureDir(dataDir());
  const target = DATA_FILE();
  const tmp = `${target}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  const handle = await fs.open(tmp, "w");
  try {
    await handle.writeFile(JSON.stringify(data, null, 2), "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fs.rename(tmp, target);
  cache = data;
  cacheTime = Date.now();
}

let cache: PersistedData | null = null;
let cacheTime = 0;
const CACHE_MS = 1000;

export async function getData(): Promise<PersistedData> {
  if (cache && Date.now() - cacheTime < CACHE_MS) return cache;
  cache = await loadData();
  cacheTime = Date.now();
  return cache;
}

// ── Scan orchestration ────────────────────────────────────────────────

let state: ScanState = {
  scanning: false,
  phase: null,
  progress: 0,
  lastScanAt: null,
  appCount: 0,
  newCount: 0,
  error: null,
};

export function getScanState(): ScanState {
  return state;
}

/** Returns newly added app ids since the previous stored list. */
export function diffIds(previous: DetectedApp[], next: DetectedApp[]): string[] {
  const prev = new Set(previous.map((a) => a.id));
  return next.filter((a) => !prev.has(a.id)).map((a) => a.id);
}

let scanPromise: Promise<DetectedApp[]> | null = null;

export function scanInProgress(): boolean {
  return scanPromise !== null;
}

/** Runs a scan (single-flight). Resolves with the app list. */
export function scanNow(): Promise<DetectedApp[]> {
  if (scanPromise) return scanPromise;
  scanPromise = (async () => {
    const before = await getData();
    state = {
      ...state,
      scanning: true,
      phase: "Starting",
      progress: 0,
      error: null,
    };
    try {
      const apps = await runScan(before.apps, (patch) => {
        state = { ...state, ...patch };
      });
      const added = diffIds(before.apps, apps);
      const next: PersistedData = {
        version: 1,
        apps,
        lastScanAt: new Date().toISOString(),
        scanCount: before.scanCount + 1,
      };
      await saveData(next);
      state = {
        scanning: false,
        phase: null,
        progress: 100,
        lastScanAt: next.lastScanAt,
        appCount: apps.length,
        newCount: added.length,
        error: null,
      };
      return apps;
    } catch (err) {
      state = {
        ...state,
        scanning: false,
        phase: null,
        error: err instanceof Error ? err.message : String(err),
      };
      throw err;
    } finally {
      scanPromise = null;
    }
  })();
  return scanPromise;
}
