import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { DESKTOP_PUBLIC, DESKTOP_USER, START_MENU_COMMON, START_MENU_USER } from "./paths.js";
import { shellLaunch } from "./scripts.js";
import type { DetectedApp } from "./types.js";

const AUMID = /^[A-Za-z0-9][A-Za-z0-9._-]*![\x21-\x7e]+$/;

/** Roots a launchable file may live under. Anything else is refused. */
function launchRoots() {
  const local = process.env.LOCALAPPDATA ?? "";
  return [
    DESKTOP_USER,
    DESKTOP_PUBLIC,
    START_MENU_USER,
    START_MENU_COMMON,
    process.env.ProgramFiles ?? "C:\\Program Files",
    process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)",
    process.env.ProgramW6432 ?? "C:\\Program Files",
    local,
    path.join(local, "Programs"),
    "D:\\Softwares",
    "D:\\Games",
  ]
    .filter(Boolean)
    .map((p) => path.resolve(p).toLowerCase() + path.sep);
}

function isUnderAllowedRoot(file: string) {
  const resolved = path.resolve(file).toLowerCase();
  return launchRoots().some((root) => resolved.startsWith(root));
}

export interface LaunchOutcome {
  launched: boolean;
  reason?: string;
}

function spawnDetached(file: string, args: string[], cwd?: string | null) {
  const child = spawn(file, args, {
    cwd: cwd && cwd.trim() ? cwd : undefined,
    detached: true,
    stdio: "ignore",
    windowsHide: false,
  });
  child.on("error", () => undefined);
  child.unref();
}

/** CreateProcess refuses exes whose manifest requires elevation (error 740);
 *  the shell path (Start-Process) honors them and shows the UAC prompt. */
async function shellLaunchSafe(file: string, args: string[], cwd?: string | null): Promise<LaunchOutcome> {
  let res;
  try {
    res = await shellLaunch(file, args, cwd);
  } catch (err) {
    // runPs timeout — usually an unanswered UAC consent prompt.
    const msg = err instanceof Error && /timed out/i.test(err.message)
      ? "Timed out waiting for Windows permission (UAC)"
      : "Launch failed";
    return { launched: false, reason: msg };
  }
  if (res.ok) return { launched: true };
  return { launched: false, reason: res.error ?? "Windows refused to start it" };
}

/** Splits a shortcut's Arguments string into argv without invoking a shell. */
function splitArgs(raw: string | null): string[] {
  if (!raw) return [];
  const out: string[] = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) out.push(m[1] ?? m[2]);
  return out;
}

/**
 * Launches a previously-scanned app by id. The request supplies only the id;
 * every path, argument and working directory comes from the trusted scan store.
 */
export async function launchApp(apps: DetectedApp[], id: string): Promise<LaunchOutcome> {
  const app = apps.find((a) => a.id === id);
  if (!app) return { launched: false, reason: "Unknown application" };

  // 1) Shell AppUserModelID (UWP / packaged apps).
  if (app.appsFolderId && AUMID.test(app.appsFolderId)) {
    spawnDetached("explorer.exe", [`shell:AppsFolder\\${app.appsFolderId}`]);
    return { launched: true };
  }

  // 2) Direct executable — through the shell so elevation manifests work.
  if (app.executablePath) {
    const exe = app.executablePath;
    if (!isUnderAllowedRoot(exe)) return { launched: false, reason: "Executable outside allowed locations" };
    try {
      await fs.access(exe);
    } catch {
      return { launched: false, reason: "Executable no longer exists" };
    }
    return shellLaunchSafe(exe, splitArgs(app.arguments), app.workingDirectory);
  }

  // 3) Shortcut (.lnk) — resolved through the shell so Windows applies its own
  //    security context; path must live under an allowed root.
  if (app.shortcutPath && app.shortcutPath.toLowerCase().endsWith(".lnk")) {
    if (!isUnderAllowedRoot(app.shortcutPath)) return { launched: false, reason: "Shortcut outside allowed locations" };
    try {
      await fs.access(app.shortcutPath);
    } catch {
      return { launched: false, reason: "Shortcut no longer exists" };
    }
    return shellLaunchSafe(app.shortcutPath, [], null);
  }

  return { launched: false, reason: "No launch target available" };
}
