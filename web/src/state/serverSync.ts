import { api, ApiError } from "../api/client";
import { STORAGE_KEY } from "./defaults";
import { adoptPersistCache, persistCacheExternal, useStore, writePersistCache } from "./store";
import type { PersistedState } from "../types";

/**
 * Mirrors the user organization to the companion so settings survive the
 * embedded browser wiping its profile (Lively restarts its CEF runtime, which
 * can drop localStorage). The server stores the state as an opaque blob.
 *
 * Reconciliation on boot: whichever snapshot is newer wins by savedAt; a local
 * snapshot without sync metadata (freshly seeded by tests or written by an
 * older build) always wins, then becomes the first thing backed up. While
 * running, every committed persist change pushes (debounced), and a pending
 * push flushes via sendBeacon when the page is hidden or killed.
 */

const SYNC_KEY = "mantle.v1.sync";
const PUSH_DEBOUNCE_MS = 1200;

interface SyncMeta {
  rev: number;
  savedAt: number;
}

interface RemoteEnvelope {
  rev: number;
  savedAt: number;
  state: PersistedState | null;
}

let started = false;
let lastMeta: SyncMeta = { rev: 0, savedAt: 0 };
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pending = false;
/** Guards the store subscription while an adopted snapshot is set into the store. */
let adopting = false;

function readMeta(): SyncMeta | null {
  try {
    const raw = localStorage.getItem(SYNC_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SyncMeta>;
    if (typeof parsed.rev !== "number" || typeof parsed.savedAt !== "number") return null;
    return { rev: parsed.rev, savedAt: parsed.savedAt };
  } catch {
    return null;
  }
}

function writeMeta(meta: SyncMeta) {
  try {
    localStorage.setItem(SYNC_KEY, JSON.stringify(meta));
  } catch {
    /* quota — localStorage is only the cache, the server copy still holds it */
  }
}

function schedulePush() {
  pending = true;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void push(), PUSH_DEBOUNCE_MS);
}

async function push() {
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  pending = false;
  if (!useStore.getState().hydrated) return;
  // Storage mutated externally (test seed, another surface): fold it in first
  // so the server receives the newer snapshot, not this page's stale one.
  if (persistCacheExternal()) adoptPersistCache();
  const meta: SyncMeta = { rev: lastMeta.rev + 1, savedAt: Date.now() };
  try {
    await api.put("/ui-state", { rev: meta.rev, savedAt: meta.savedAt, state: useStore.getState().persist });
    lastMeta = meta;
    writeMeta(meta);
  } catch (err) {
    // A laggard instance lost the rev race: adopt the server's revision so the
    // next push passes the monotonic check. Its newer snapshot stands.
    if (err instanceof ApiError && err.status === 409) {
      try {
        const cur = await api.get<RemoteEnvelope>("/ui-state");
        lastMeta = { rev: cur.rev, savedAt: lastMeta.savedAt };
      } catch {
        /* offline — retry on the next change */
      }
    }
    /* offline — localStorage still holds it; the next change retries */
  }
}

/** Last-chance flush when Lively tears the webview down without an unload. */
function flushPush() {
  if (!pending) return;
  pending = false;
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  if (!useStore.getState().hydrated) return;
  // Never beacon a stale snapshot over an external edit; the post-boot
  // reconcile will push the newer one instead.
  if (persistCacheExternal()) return;
  const meta: SyncMeta = { rev: lastMeta.rev + 1, savedAt: Date.now() };
  const body = JSON.stringify({ rev: meta.rev, savedAt: meta.savedAt, state: useStore.getState().persist });
  // The mantle_session cookie authenticates this request (headers can't ride a beacon).
  const queued = navigator.sendBeacon?.("/api/ui-state", new Blob([body], { type: "application/json" }));
  if (queued) {
    lastMeta = meta;
    writeMeta(meta);
  }
}

/** Swap the store over to a newer server snapshot (localStorage was behind). */
function adopt(remote: RemoteEnvelope) {
  if (!remote.state) return;
  writePersistCache(JSON.stringify(remote.state));
  lastMeta = { rev: Math.max(lastMeta.rev, remote.rev), savedAt: remote.savedAt };
  writeMeta(lastMeta);
  adopting = true;
  try {
    // hydrate() re-reads localStorage, so the snapshot gets the same
    // normalization (settings defaults, dock merge) as any boot.
    useStore.getState().hydrate();
  } finally {
    adopting = false;
  }
}

function reconcile(remote: RemoteEnvelope) {
  const localRaw = localStorage.getItem(STORAGE_KEY);
  const localMeta = readMeta();

  // Fresh browser profile — Lively wiped it. The companion copy is the truth.
  if (!localRaw) {
    if (remote.state) adopt(remote);
    return;
  }
  // No sync metadata: written by an older build or seeded externally; it wins
  // once and is then backed up.
  if (!localMeta) {
    void push();
    return;
  }
  if (remote.state && remote.savedAt > localMeta.savedAt) {
    adopt(remote);
    return;
  }
  void push();
}

async function reconcileOnce() {
  for (let attempt = 0; ; attempt++) {
    try {
      const remote = await api.get<RemoteEnvelope>("/ui-state");
      // A fresh browser profile starts at rev 0 while the server may be far
      // ahead; continue the server's revision so the first push never 409s.
      if (remote.rev > lastMeta.rev) lastMeta = { ...lastMeta, rev: remote.rev };
      reconcile(remote);
      return;
    } catch {
      // Companion not up yet (logon race); keep trying quietly.
      await new Promise((r) => setTimeout(r, Math.min(15000, 3000 * 2 ** Math.min(attempt, 4))));
    }
  }
}

export function initServerSync() {
  if (started || typeof localStorage === "undefined") return;
  started = true;
  lastMeta = readMeta() ?? { rev: 0, savedAt: 0 };

  useStore.subscribe((state, prev) => {
    if (adopting) return;
    if (!state.hydrated || state.persist === prev.persist) return;
    schedulePush();
  });

  window.addEventListener("pagehide", flushPush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushPush();
  });

  void reconcileOnce();
}
