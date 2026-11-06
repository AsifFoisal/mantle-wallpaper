import type {
  Category,
  CategoryIcon,
  DockSettings,
  PanelGeometry,
  PersistedState,
  Settings,
} from "../types";

export const STORAGE_KEY = "mantle.v1";
export const SCHEMA_VERSION = 1;

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "games", name: "Games", icon: "gamepad-2", color: "#8f9cff", order: 0, accentTagline: "play" },
  { id: "development", name: "Development", icon: "code-2", color: "#8fd6c6", order: 1, accentTagline: "build" },
  { id: "design", name: "Design & Creative", icon: "palette", color: "#e8a3b6", order: 2, accentTagline: "make" },
  { id: "productivity", name: "Productivity", icon: "briefcase", color: "#d9c7a3", order: 3, accentTagline: "work" },
  { id: "browsers", name: "Browsers", icon: "globe", color: "#a6c8ff", order: 4, accentTagline: "browse" },
  { id: "media", name: "Media & Entertainment", icon: "music", color: "#c9a6f5", order: 5, accentTagline: "watch" },
  { id: "utilities", name: "Utilities", icon: "wrench", color: "#b3b6c2", order: 6, accentTagline: "tools" },
];

export const CATEGORY_ICON_OPTIONS: CategoryIcon[] = [
  "gamepad-2",
  "code-2",
  "palette",
  "briefcase",
  "globe",
  "music",
  "wrench",
  "folder",
  "star",
  "sparkles",
  "camera",
  "terminal",
];

export const CATEGORY_COLOR_OPTIONS = [
  "#d9c7a3",
  "#8f9cff",
  "#8fd6c6",
  "#e8a3b6",
  "#a6c8ff",
  "#c9a6f5",
  "#b3b6c2",
  "#f0b48a",
  "#9be3a8",
  "#f2a3a3",
];

export const DEFAULT_SETTINGS: Settings = {
  username: "",
  clockFormat: "12h",
  dateFormat: "long",
  clockGreeting: true,
  showClock: true,
  showDate: true,
  // The clock's default is clamped to the bottom-left on any monitor size.
  clockPosition: { x: 96, y: 730 },
  clockSize: 132,
  clockLocked: false,
  animationEnabled: true,
  lowResourceMode: false,
  showRunningIndicator: true,
  background: {
    mode: "ambient",
    imageDataUrl: null,
    imageFit: "cover",
    gradientFrom: "#0b0d12",
    gradientTo: "#1d1a2e",
    gradientAngle: 140,
    ambientIntensity: 100,
  },
  floatingButton: {
    x: -1,
    y: 28,
    visible: true,
    hoverOnly: false,
    locked: false,
  },
  searchShortcutLabel: "Ctrl K",
};

export function defaultPanelGeometry(index: number, offsetCount: number): PanelGeometry {
  const col = index % 3;
  const row = Math.floor((index - col) / 3);
  return {
    x: 96 + col * 48 + (offsetCount % 4) * 22,
    y: 140 + row * 56 + (offsetCount % 5) * 18,
    w: 384,
    h: 452,
    open: false,
    minimized: false,
    locked: false,
  };
}

export const DEFAULT_DOCK: DockSettings = {
  visible: true,
  x: -1,
  y: -1,
  orientation: "horizontal",
  iconSize: 52,
  gap: 10,
  labels: false,
  magnification: true,
  anchored: true,
  locked: false,
  appIds: [],
};

export function defaultSettingsPanel(): PersistedState["settingsPanel"] {
  return { x: -1, y: 88, open: false };
}

export function defaultSearchPanel(): PersistedState["searchPanel"] {
  return { x: -1, y: 120 };
}

export function createDefaultState(): PersistedState {
  const panels: Record<string, PanelGeometry> = {};
  DEFAULT_CATEGORIES.forEach((c, i) => {
    panels[c.id] = defaultPanelGeometry(i, i);
  });

  return {
    version: SCHEMA_VERSION,
    settings: structuredClone(DEFAULT_SETTINGS),
    categories: structuredClone(DEFAULT_CATEGORIES),
    panels,
    panelGroups: [],
    dock: structuredClone(DEFAULT_DOCK),
    appOverrides: {},
    settingsPanel: defaultSettingsPanel(),
    searchPanel: defaultSearchPanel(),
    onboardingDismissed: false,
  };
}
