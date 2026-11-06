import { create } from "zustand";
import type {
  AppOverride,
  BackgroundSettings,
  Category,
  DockSettings,
  DetectedApp,
  PanelGeometry,
  PersistedState,
  ScanStatus,
  Settings,
  WindowInfo,
} from "../types";
import {
  DEFAULT_CATEGORIES,
  DEFAULT_DOCK,
  SCHEMA_VERSION,
  STORAGE_KEY,
  createDefaultState,
  defaultPanelGeometry,
} from "./defaults";

export type BackendStatus = "unknown" | "online" | "offline";
export type DockEdge = "top" | "bottom" | "left" | "right";

export interface Toast {
  id: string;
  title: string;
  detail?: string;
  tone: "info" | "success" | "warn";
  actionLabel?: string;
  action?: () => void;
}

export interface Store {
  hydrated: boolean;
  /** User organization — persisted. */
  persist: PersistedState;

  /** Detected apps from the companion — runtime only. */
  apps: DetectedApp[];
  scan: ScanStatus;
  backend: BackendStatus;
  backendVersion: string | null;
  /** Process names currently running, from the companion, best-effort. */
  runningNames: Set<string>;
  /** Visible top-level windows for the taskbar section of the dock. */
  windows: WindowInfo[];

  settingsOpen: boolean;
  searchOpen: boolean;
  /** When set, search opens in "add apps to this collection" mode. */
  assignTargetId: string | null;
  recentIds: string[];
  toasts: Toast[];

  hydrate: () => void;
  updateSettings: (patch: Partial<Settings>) => void;
  updateBackground: (patch: Partial<BackgroundSettings>) => void;
  updateFloatingButton: (patch: Partial<Settings["floatingButton"]>) => void;
  updateDock: (patch: Partial<DockSettings>) => void;
  updatePanel: (categoryId: string, patch: Partial<PanelGeometry>) => void;

  /** Rigid panel groups: members drag and align together. */
  createPanelGroup: (memberIds: string[]) => string;
  addPanelMembers: (groupId: string, memberIds: string[]) => void;
  removeFromPanelGroup: (panelId: string) => void;
  ungroupPanels: (groupId: string) => void;

  addCategory: (name: string, icon?: Category["icon"], color?: string) => string;
  updateCategory: (id: string, patch: Partial<Category>) => void;
  deleteCategory: (id: string) => void;
  reorderCategories: (ids: string[]) => void;
  openCategory: (id: string) => void;
  toggleCategory: (id: string) => void;
  closeCategory: (id: string) => void;

  setOverride: (appId: string, patch: Partial<AppOverride>) => void;
  assignCategory: (appId: string, categoryId: string) => void;
  unassignCategory: (appId: string, categoryId: string) => void;
  /** Persists a manual order for the given apps inside one collection. */
  setCategoryOrder: (categoryId: string, orderedIds: string[]) => void;
  toggleFavorite: (appId: string) => void;
  toggleDock: (appId: string) => void;
  renameApp: (appId: string, displayName: string) => void;

  setApps: (apps: DetectedApp[], lastScanAt: string | null) => void;
  setScan: (patch: Partial<ScanStatus>) => void;
  setBackend: (status: BackendStatus, version?: string | null) => void;
  setRunning: (names: string[]) => void;
  setWindows: (windows: WindowInfo[]) => void;
  markRecent: (appId: string) => void;

  setSettingsOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  openAssign: (categoryId: string) => void;
  endAssign: () => void;
  setSettingsPanelPos: (x: number, y: number) => void;
  setSearchPanelPos: (x: number, y: number) => void;

  toast: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;

  resetLayout: () => void;
  resetAll: () => void;
}

const emptyScan: ScanStatus = {
  scanning: false,
  phase: null,
  progress: 0,
  lastScanAt: null,
  appCount: 0,
};

function loadPersisted(): PersistedState {
  if (typeof localStorage === "undefined") return createDefaultState();
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // One-time rename migration: pre-rename layouts lived under nexus.v1.
      const legacy = localStorage.getItem("nexus.v1");
      if (legacy) {
        raw = legacy;
        try {
          localStorage.setItem(STORAGE_KEY, raw);
          localStorage.removeItem("nexus.v1");
        } catch {
          /* quota or privacy mode — the fallback read still worked */
        }
      }
    }
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    const base = createDefaultState();
    return {
      ...base,
      ...parsed,
      version: SCHEMA_VERSION,
      settings: {
        ...base.settings,
        ...(parsed.settings ?? {}),
        background: { ...base.settings.background, ...(parsed.settings?.background ?? {}) },
        floatingButton: { ...base.settings.floatingButton, ...(parsed.settings?.floatingButton ?? {}) },
      },
      dock: { ...base.dock, ...(parsed.dock ?? DEFAULT_DOCK) },
      categories: Array.isArray(parsed.categories) && parsed.categories.length ? parsed.categories : DEFAULT_CATEGORIES,
      panels: { ...base.panels, ...(parsed.panels ?? {}) },
      appOverrides: parsed.appOverrides ?? {},
      settingsPanel: { ...base.settingsPanel, ...(parsed.settingsPanel ?? {}) },
      searchPanel: { ...base.searchPanel, ...(parsed.searchPanel ?? {}) },
    };
  } catch {
    return createDefaultState();
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

// The exact mantle.v1 content this page last wrote. Anything else in there is
// an external edit (a test seed, another wallpaper surface) and must win over
// this page's stale in-memory state.
let ourLastRaw: string | null = typeof localStorage === "undefined" ? null : localStorage.getItem(STORAGE_KEY);

/** True when localStorage was mutated behind this page's back. */
export function persistCacheExternal(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) !== ourLastRaw;
}

/** Re-reads the externally written snapshot into the store. */
export function adoptPersistCache(): void {
  if (typeof localStorage !== "undefined") ourLastRaw = localStorage.getItem(STORAGE_KEY);
  useStore.getState().hydrate();
}

/** Writes through the cache tracker (the server-sync adopt path shares this). */
export function writePersistCache(raw: string): void {
  ourLastRaw = raw;
  try {
    localStorage.setItem(STORAGE_KEY, raw);
  } catch (err) {
    console.warn("[mantle] persist failed", err);
  }
}

function scheduleSave(state: PersistedState) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      // An external edit landed while this page held older state in memory:
      // adopt it instead of clobbering it.
      if (persistCacheExternal()) {
        adoptPersistCache();
        return;
      }
      writePersistCache(JSON.stringify(state));
    } catch (err) {
      console.warn("[mantle] persist failed", err);
    }
  }, 250);
}

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export const useStore = create<Store>((set, get) => {
  const commit = (
    recipe: (p: PersistedState) => PersistedState | void,
  ): void => {
    set((s) => {
      const draft = structuredClone(s.persist);
      const out = recipe(draft) ?? draft;
      scheduleSave(out);
      return { persist: out };
    });
  };

  return {
    hydrated: false,
    persist: createDefaultState(),
    apps: [],
    scan: emptyScan,
    backend: "unknown",
    backendVersion: null,
    runningNames: new Set(),
    windows: [],
    settingsOpen: false,
    searchOpen: false,
    assignTargetId: null,
    recentIds: [],
    toasts: [],

    hydrate: () => {
      set({ persist: loadPersisted(), hydrated: true });
    },

    updateSettings: (patch) => commit((p) => {
      p.settings = { ...p.settings, ...patch };
    }),
    updateBackground: (patch) => commit((p) => {
      p.settings.background = { ...p.settings.background, ...patch };
    }),
    updateFloatingButton: (patch) => commit((p) => {
      p.settings.floatingButton = { ...p.settings.floatingButton, ...patch };
    }),
    updateDock: (patch) => commit((p) => {
      p.dock = { ...p.dock, ...patch };
    }),
    updatePanel: (categoryId, patch) => commit((p) => {
      const current = p.panels[categoryId] ?? defaultPanelGeometry(0, 0);
      p.panels[categoryId] = { ...current, ...patch };
    }),

    createPanelGroup: (memberIds) => {
      const id = uid("grp");
      commit((p) => {
        p.panelGroups = [...p.panelGroups.filter((g) => !g.members.some((m) => memberIds.includes(m))), { id, members: [...memberIds] }];
      });
      return id;
    },
    addPanelMembers: (groupId, memberIds) => commit((p) => {
      p.panelGroups = p.panelGroups.map((g) => (g.id === groupId ? { ...g, members: [...new Set([...g.members, ...memberIds])] } : g));
    }),
    removeFromPanelGroup: (panelId) => commit((p) => {
      p.panelGroups = p.panelGroups
        .map((g) => ({ ...g, members: g.members.filter((m) => m !== panelId) }))
        .filter((g) => g.members.length >= 2);
    }),
    ungroupPanels: (groupId) => commit((p) => {
      p.panelGroups = p.panelGroups.filter((g) => g.id !== groupId);
    }),

    addCategory: (name, icon = "folder", color = "#d9c7a3") => {
      const id = uid("cat");
      commit((p) => {
        const order = p.categories.length ? Math.max(...p.categories.map((c) => c.order)) + 1 : 0;
        p.categories.push({ id, name: name.trim() || "Untitled", icon, color, order });
        p.panels[id] = { ...defaultPanelGeometry(p.categories.length - 1, p.categories.length), open: false };
      });
      return id;
    },
    updateCategory: (id, patch) => commit((p) => {
      p.categories = p.categories.map((c) => (c.id === id ? { ...c, ...patch } : c));
    }),
    deleteCategory: (id) => commit((p) => {
      p.categories = p.categories.filter((c) => c.id !== id);
      delete p.panels[id];
      p.panelGroups = p.panelGroups
        .map((g) => ({ ...g, members: g.members.filter((m) => m !== id) }))
        .filter((g) => g.members.length >= 2);
      for (const override of Object.values(p.appOverrides)) {
        if (override.categories) override.categories = override.categories.filter((c) => c !== id);
      }
    }),
    reorderCategories: (ids) => commit((p) => {
      p.categories = p.categories.map((c) => ({ ...c, order: ids.indexOf(c.id) >= 0 ? ids.indexOf(c.id) : c.order }));
    }),
    openCategory: (id) => commit((p) => {
      const current = p.panels[id] ?? defaultPanelGeometry(0, 0);
      p.panels[id] = { ...current, open: true, minimized: false };
    }),
    toggleCategory: (id) => {
      const current = get().persist.panels[id];
      if (current?.open) get().closeCategory(id);
      else get().openCategory(id);
    },
    closeCategory: (id) => commit((p) => {
      const current = p.panels[id];
      if (!current) return;
      p.panels[id] = { ...current, open: false };
    }),

    setOverride: (appId, patch) => commit((p) => {
      p.appOverrides[appId] = { ...(p.appOverrides[appId] ?? {}), ...patch };
    }),
    assignCategory: (appId, categoryId) => commit((p) => {
      const o = (p.appOverrides[appId] ??= {});
      const cats = new Set(o.categories ?? []);
      cats.add(categoryId);
      o.categories = [...cats];
      o.categoriesManual = true;
    }),
    setCategoryOrder: (categoryId, orderedIds) => commit((p) => {
      orderedIds.forEach((appId, index) => {
        const o = (p.appOverrides[appId] ??= {});
        o.order = { ...(o.order ?? {}), [categoryId]: index };
      });
    }),
    unassignCategory: (appId, categoryId) => commit((p) => {
      const o = (p.appOverrides[appId] ??= {});
      o.categories = (o.categories ?? []).filter((c) => c !== categoryId);
      o.categoriesManual = true;
    }),
    toggleFavorite: (appId) => commit((p) => {
      const o = (p.appOverrides[appId] ??= {});
      o.isFavorite = !o.isFavorite;
    }),
    toggleDock: (appId) => commit((p) => {
      p.dock.appIds = p.dock.appIds.includes(appId)
        ? p.dock.appIds.filter((a) => a !== appId)
        : [...p.dock.appIds, appId];
    }),
    renameApp: (appId, displayName) => commit((p) => {
      const o = (p.appOverrides[appId] ??= {});
      o.displayName = displayName.trim() || undefined;
    }),

    setApps: (apps, lastScanAt) => set((s) => ({
      apps,
      scan: { ...s.scan, appCount: apps.length, lastScanAt: lastScanAt ?? s.scan.lastScanAt },
    })),
    setScan: (patch) => set((s) => ({ scan: { ...s.scan, ...patch } })),
    setBackend: (status, version) => set((s) => ({
      backend: status,
      backendVersion: version === undefined ? s.backendVersion : version,
    })),
    setRunning: (names) => set({ runningNames: new Set(names.map((n) => n.toLowerCase())) }),
    setWindows: (windows) => set({ windows }),
    markRecent: (appId) => set((s) => ({
      recentIds: [appId, ...s.recentIds.filter((id) => id !== appId)].slice(0, 8),
    })),

    setSettingsOpen: (open) => set({ settingsOpen: open, searchOpen: false }),
    setSearchOpen: (open) => set({
      searchOpen: open,
      settingsOpen: open ? false : get().settingsOpen,
      assignTargetId: open ? null : null,
    }),
    openAssign: (categoryId) => set({ assignTargetId: categoryId, searchOpen: true, settingsOpen: false }),
    endAssign: () => set({ assignTargetId: null, searchOpen: false }),
    setSettingsPanelPos: (x, y) => commit((p) => {
      p.settingsPanel = { ...p.settingsPanel, x, y };
    }),
    setSearchPanelPos: (x, y) => commit((p) => {
      p.searchPanel = { ...p.searchPanel, x, y };
    }),

    toast: (t) => {
      const id = uid("toast");
      set((s) => ({ toasts: [...s.toasts, { ...t, id }].slice(-4) }));
      const lifetime = t.actionLabel ? 14000 : 4800;
      setTimeout(() => get().dismissToast(id), lifetime);
    },
    dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

    resetLayout: () => commit((p) => {
      const fresh = createDefaultState();
      p.panels = fresh.panels;
      p.dock = { ...p.dock, x: -1, y: -1, anchored: true };
      p.settings.floatingButton = { ...fresh.settings.floatingButton };
      p.settings.clockPosition = { ...fresh.settings.clockPosition };
      p.settingsPanel = fresh.settingsPanel;
      p.searchPanel = fresh.searchPanel;
    }),
    resetAll: () => {
      const fresh = createDefaultState();
      scheduleSave(fresh);
      set({ persist: fresh });
    },
  };
});

/** Merge detected app with user override. */
export function appDisplayName(app: DetectedApp, override?: AppOverride): string {
  return override?.displayName || app.displayName || app.name;
}
