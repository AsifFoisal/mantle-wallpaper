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

export interface ShortcutRecord {
  name: string;
  shortcutPath: string;
  target: string | null;
  arguments: string | null;
  workingDirectory: string | null;
  targetType: string | null;
  source: "start-menu" | "desktop";
  exists: boolean;
}

export interface UwpRecord {
  name: string;
  appsFolderId: string;
  executableName: string | null;
  executablePath: string | null;
}

export interface RegistryRecord {
  name: string;
  displayName: string;
  displayIcon: string | null;
  installLocation: string | null;
  publisher: string | null;
  source: string;
}

export interface ScanState {
  scanning: boolean;
  phase: string | null;
  progress: number;
  lastScanAt: string | null;
  appCount: number;
  newCount: number;
  error: string | null;
}

export interface PersistedData {
  version: number;
  apps: DetectedApp[];
  lastScanAt: string | null;
  scanCount: number;
}
