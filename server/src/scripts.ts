import path from "node:path";
import { runPs, parseJson } from "./powershell.js";
import type { ShortcutRecord, UwpRecord, RegistryRecord } from "./types.js";

import { directoryOf } from "./paths.js";

export function scriptsPath(name: string) {
  // src/ or dist/ -> server/ -> server/powershell/
  const here = directoryOf(import.meta.url);
  const serverDir = path.basename(here) === "dist" ? path.dirname(here) : path.dirname(here);
  return path.join(serverDir, "powershell", name);
}

export async function resolveShortcuts(items: { path: string; name: string; source: "start-menu" | "desktop" }[]): Promise<ShortcutRecord[]> {
  if (!items.length) return [];
  const { stdout } = await runPs(scriptsPath("resolve-shortcuts.ps1"), { items });
  try {
    const parsed = parseJson<ShortcutRecord | ShortcutRecord[]>(stdout);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

export async function listUwp(): Promise<UwpRecord[]> {
  const { stdout } = await runPs(scriptsPath("list-uwp.ps1"), {}, 60_000);
  try {
    const parsed = parseJson<UwpRecord | UwpRecord[]>(stdout);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

export async function listRegistry(): Promise<RegistryRecord[]> {
  const { stdout } = await runPs(scriptsPath("list-registry.ps1"), {}, 90_000);
  try {
    const parsed = parseJson<RegistryRecord | RegistryRecord[]>(stdout);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

export interface AppxRecord {
  packageFamilyName: string;
  applicationId: string;
  displayName: string;
  installLocation: string;
  logo: string | null;
}

export async function listAppx(): Promise<AppxRecord[]> {
  const { stdout } = await runPs(scriptsPath("list-appx.ps1"), {}, 120_000);
  try {
    const parsed = parseJson<AppxRecord | AppxRecord[]>(stdout);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

export async function findAppxLogo(installLocation: string, logo: string): Promise<string | null> {
  const { stdout } = await runPs(scriptsPath("find-logo.ps1"), { installLocation, logo }, 20_000);
  try {
    return parseJson<{ path: string | null }>(stdout).path;
  } catch {
    return null;
  }
}

export async function extractIcon(target: string, outDir: string): Promise<number[]> {
  const { stdout } = await runPs(scriptsPath("extract-icon.ps1"), { target, outDir }, 30_000);
  try {
    const parsed = parseJson<{ ok: boolean; sizes: number[] }>(stdout);
    return parsed.sizes ?? [];
  } catch {
    return [];
  }
}

export interface ShellLaunchResult {
  ok: boolean;
  pid?: number;
  error?: string;
}

/**
 * Launches through the shell so elevation manifests raise UAC and shortcuts
 * resolve normally. Blocks until the shell call returns (a waiting UAC prompt
 * extends this) — the runPs timeout bounds it.
 */
export async function shellLaunch(file: string, args: string[], cwd?: string | null): Promise<ShellLaunchResult> {
  const { stdout } = await runPs(scriptsPath("launch.ps1"), { file, args, cwd: cwd ?? "" }, 90_000);
  try {
    return parseJson<ShellLaunchResult>(stdout);
  } catch {
    return { ok: false, error: "Launch script failed" };
  }
}
