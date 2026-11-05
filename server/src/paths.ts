import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const APP_VERSION = "1.0.0";

export function dataDir(): string {
  const base = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
  return path.join(base, "Mantle Wallpaper");
}

/** Windows path of the directory containing a module (fileURLToPath-safe). */
export function directoryOf(metaUrl: string): string {
  return path.dirname(fileURLToPath(metaUrl));
}

export function iconsDir(): string {
  return path.join(dataDir(), "icons");
}

export function serverRoot(): string {
  // src (tsx) or dist (built) -> server/
  return path.resolve(directoryOf(import.meta.url), "..");
}

export function webDistDir(): string {
  return path.resolve(serverRoot(), "..", "web", "dist");
}

export async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export const START_MENU_USER = path.join(process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming"), "Microsoft", "Windows", "Start Menu", "Programs");
export const START_MENU_COMMON = path.join(process.env.PROGRAMDATA ?? "C:\\ProgramData", "Microsoft", "Windows", "Start Menu", "Programs");
export const DESKTOP_USER = path.join(os.homedir(), "Desktop");
export const DESKTOP_PUBLIC = path.join(process.env.PUBLIC ?? "C:\\Users\\Public", "Desktop");
