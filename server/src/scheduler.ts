import { getData, scanInProgress, scanNow } from "./store.js";

const FIRST_SCAN_DELAY_MS = 1500;
const RESCAN_INTERVAL_MS = 20 * 60 * 1000;

/**
 * Scans shortly after boot, then periodically so newly installed apps appear.
 * Every scan merges with stored data; user organization lives in the frontend.
 */
export function startScanScheduler() {
  let timer: ReturnType<typeof setInterval> | null = null;
  let stopped = false;

  const tick = async () => {
    if (stopped || scanInProgress()) return;
    try {
      await scanNow();
    } catch (err) {
      console.warn("[mantle] scheduled scan failed:", err instanceof Error ? err.message : err);
    }
  };

  setTimeout(async () => {
    const data = await getData();
    if (!data.apps.length || Date.now() - Date.parse(data.lastScanAt ?? "0") > RESCAN_INTERVAL_MS) {
      void tick();
    }
    if (!stopped && !timer) timer = setInterval(tick, RESCAN_INTERVAL_MS);
  }, FIRST_SCAN_DELAY_MS);

  return () => {
    stopped = true;
    if (timer) clearInterval(timer);
  };
}
