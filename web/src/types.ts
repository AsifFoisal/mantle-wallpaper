/** Detected application record from the companion service. */
export type AppSource = "start-menu" | "desktop" | "uwp" | "registry";

export interface DetectedApp {
  id: string;
  name: string;
  displayName: string;
  executablePath: string | null;
  shortcutPath: string | null;
  appsFolderId: string | null;
  arguments: string | null;
  workingDirectory: string | null;
  executableName: string | null;
  source: AppSource;
  installLocation: string | null;
  publisher: string | null;
  hasIcon: boolean;
  dateDetected: string;
  targetExists: boolean;
}

export interface ScanStatus {
  scanning: boolean;
  phase: string | null;
  progress: number;
  lastScanAt: string | null;
  appCount: number;
}

export type CategoryIcon =
  | "gamepad-2"
  | "code-2"
  | "palette"
  | "briefcase"
  | "globe"
  | "music"
  | "wrench"
  | "folder"
  | "star"
  | "sparkles"
  | "camera"
  | "terminal";

export interface Category {
  id: string;
  name: string;
  icon: CategoryIcon;
  color: string;
  order: number;
  accentTagline?: string;
}

export interface PanelGeometry {
  x: number;
  y: number;
  w: number;
  h: number;
  open: boolean;
  minimized: boolean;
  locked: boolean;
}

export interface FloatingPos {
  x: number;
  y: number;
}

/** A visible top-level window reported by the companion (taskbar section). */
export interface WindowInfo {
  hwnd: number;
  pid: number;
  title: string;
  /** Process image name with extension (e.g. "chrome.exe"), "" when unavailable. */
  exe: string;
  minimized: boolean;
}

export interface DockSettings {
  visible: boolean;
  x: number;
  y: number;
  orientation: "horizontal" | "vertical";
  iconSize: number;
  gap: number;
  labels: boolean;
  magnification: boolean;
  anchored: boolean;
  locked: boolean;
  appIds: string[];
}

export interface AppOverride {
  displayName?: string;
  /** Manual sort rank inside each collection (lower first). */
  order?: Record<string, number>;
  iconDataUrl?: string;
  categories?: string[];
  categoriesManual?: boolean;
  isFavorite?: boolean;
  ignoredSuggestion?: boolean;
}

export type BackgroundMode = "ambient" | "gradient" | "image";

export interface BackgroundSettings {
  mode: BackgroundMode;
  imageDataUrl: string | null;
  imageFit: "cover" | "contain";
  gradientFrom: string;
  gradientTo: string;
  gradientAngle: number;
  ambientIntensity: number;
}

export interface Settings {
  username: string;
  clockFormat: "12h" | "24h";
  dateFormat: "long" | "short" | "numeric";
  clockGreeting: boolean;
  showClock: boolean;
  showDate: boolean;
  clockPosition: FloatingPos;
  clockSize: number;
  clockLocked: boolean;
  animationEnabled: boolean;
  lowResourceMode: boolean;
  showRunningIndicator: boolean;
  background: BackgroundSettings;
  floatingButton: {
    x: number;
    y: number;
    visible: boolean;
    hoverOnly: boolean;
    locked: boolean;
  };
  searchShortcutLabel: string;
}

export interface AppOverrideMap {
  [appId: string]: AppOverride;
}

export interface PersistedState {
  version: number;
  settings: Settings;
  categories: Category[];
  panels: Record<string, PanelGeometry>;
  dock: DockSettings;
  appOverrides: AppOverrideMap;
  settingsPanel: { x: number; y: number; open: boolean };
  searchPanel: { x: number; y: number };
  onboardingDismissed: boolean;
}
