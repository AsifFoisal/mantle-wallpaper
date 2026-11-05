import { runPs, parseJson } from "./powershell.js";
import { scriptsPath } from "./scripts.js";

export interface NativeWindow {
  hwnd: number;
  pid: number;
  title: string;
  /** Process image name with extension (e.g. "chrome.exe"), "" when unavailable. */
  exe: string;
  minimized: boolean;
}

/** Visible top-level windows snapshot for the taskbar. */
export async function listWindows(): Promise<NativeWindow[]> {
  const { stdout } = await runPs(scriptsPath("windows.ps1"), {}, 20_000);
  try {
    const parsed = parseJson<NativeWindow | NativeWindow[]>(stdout);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

/** Minimize or restore one top-level window by hwnd. */
export async function windowAction(action: "minimize" | "restore", hwnd: number): Promise<boolean> {
  const { stdout } = await runPs(scriptsPath("windows.ps1"), { action, hwnd }, 20_000);
  return /true/i.test(stdout);
}
