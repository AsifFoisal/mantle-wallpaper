import { useEffect, useRef } from "react";
import { useStore } from "../state/store";
import { mantleApi, toScanStatus } from "../api/mantle";

const POLL_MS = 3000;
const ACTIVE_POLL_MS = 900;

/**
 * Keeps the store in sync with the companion: status, app list, running processes.
 * Degrades to "offline" silently; the wallpaper keeps working from localStorage.
 */
export function useBackendSync(onScanComplete?: React.RefObject<(() => void) | null>) {
  const setBackend = useStore((s) => s.setBackend);
  const setScan = useStore((s) => s.setScan);
  const setApps = useStore((s) => s.setApps);
  const scanning = useStore((s) => s.scan.scanning);
  const appsLoaded = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    let failures = 0;

    const tick = async () => {
      if (!alive.current) return;
      let delay = POLL_MS;
      let justScanned = false;
      try {
        const status = await mantleApi.status();
        const wasScanning = useStore.getState().scan.scanning;
        failures = 0;
        setBackend("online", status.version);
        setScan(toScanStatus(status));
        if (!appsLoaded.current || !status.scanning) {
          const res = await mantleApi.apps();
          setApps(res.apps, res.lastScanAt);
          appsLoaded.current = true;
        }
        justScanned = wasScanning && !status.scanning;
        if (status.scanning) delay = ACTIVE_POLL_MS;
      } catch {
        failures += 1;
        if (failures >= 2) setBackend("offline");
        delay = Math.min(15000, POLL_MS * 2 ** failures);
      }
      if (justScanned) onScanComplete?.current?.();
      if (alive.current) timer.current = setTimeout(tick, delay);
    };

    void tick();
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [setBackend, setScan, setApps, scanning]);

  // Window snapshot poll: feeds the taskbar section and the running indicators.
  // Window enumeration also yields the running process names, so one call
  // replaces the old tasklist poll. Only while the page is visible; each
  // snapshot is a cheap cached-DLL PowerShell call (~300ms server-side).
  useEffect(() => {
    let stop = false;
    const poll = async () => {
      if (stop) return;
      const state = useStore.getState();
      if (state.backend === "online" && !state.persist.settings.lowResourceMode && document.visibilityState === "visible") {
        try {
          const res = await mantleApi.windows();
          state.setWindows(res.windows);
          const exes = [...new Set(res.windows.map((w) => w.exe).filter(Boolean))];
          state.setRunning(exes);
        } catch {
          /* offline — taskbar keeps the last snapshot */
        }
      }
      if (!stop) setTimeout(poll, 3000);
    };
    const t = setTimeout(poll, 2500);
    return () => {
      stop = true;
      clearTimeout(t);
    };
  }, []);
}
