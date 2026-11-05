import type { DetectedApp, ScanStatus, WindowInfo } from "../types";
import { api, ensureToken } from "./client";

let devToken: string | null = null;
void ensureToken().then((t) => {
  devToken = t;
});

export interface StatusResponse {
  ok: boolean;
  version: string;
  platform: string;
  scanning: boolean;
  phase: string | null;
  progress: number;
  lastScanAt: string | null;
  appCount: number;
  newCount: number;
}

export interface AppsResponse {
  apps: DetectedApp[];
  lastScanAt: string | null;
}

export const mantleApi = {
  status: () => api.get<StatusResponse>("/system/status"),
  apps: () => api.get<AppsResponse>("/apps"),
  scan: () => api.post<{ started: boolean }>("/apps/scan"),
  launch: (id: string) => api.post<{ launched: boolean }>("/apps/launch", { id }),
  running: (ids: string[]) => api.post<{ running: string[] }>("/apps/running", { ids }),
  windows: () => api.get<{ windows: WindowInfo[] }>("/windows"),
  windowAction: (action: "minimize" | "restore", hwnd: number) => api.post<{ ok: boolean }>("/windows/action", { action, hwnd }),
  iconUrl: (id: string, updatedAt = "") => {
    // <img> can't send headers; in dev the Vite proxy has no cookie yet, so pass
    // the token as a query param. Production uses the session cookie.
    const t = typeof window !== "undefined" ? (window.__MANTLE_TOKEN__ ?? devToken) : null;
    const qs = new URLSearchParams();
    if (updatedAt) qs.set("v", updatedAt);
    if (t && !window.__MANTLE_TOKEN__) qs.set("t", t);
    const suffix = qs.toString();
    return `/api/icons/${encodeURIComponent(id)}${suffix ? `?${suffix}` : ""}`;
  },
};

export function toScanStatus(s: StatusResponse): Partial<ScanStatus> {
  return {
    scanning: s.scanning,
    phase: s.phase,
    progress: s.progress,
    lastScanAt: s.lastScanAt,
    appCount: s.appCount,
  };
}
