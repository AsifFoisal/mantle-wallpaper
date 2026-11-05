import { promises as fs } from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { resolveShortcuts, listUwp, listRegistry, listAppx } from "./scripts.js";
import { DESKTOP_PUBLIC, DESKTOP_USER, START_MENU_COMMON, START_MENU_USER, dataDir } from "./paths.js";
import { promises as fsPromises } from "node:fs";
import type { DetectedApp, RegistryRecord, ScanState, ShortcutRecord, UwpRecord } from "./types.js";

/** Heuristic filter: system noise that should never show up as a launchable app. */
const JUNK_NAME = [
  /\buninstall(er)?\b/i,
  /\bunins\d+/i,
  /^uninstall$/i,
  /\bread ?me\b/i,
  /\bhelp\b/i,
  /\bdocumentation\b/i,
  /\bmanual\b/i,
  /\brelease notes?\b/i,
  /\blicen[sc]e\b/i,
  /\bwebsite\b$/i,
  /\bsupport( center)?\b$/i,
  /\bsamples?\b$/i,
  /\bweb ?site\b/i,
  /\bdoc(s|umentation)?\b/i,
  /\bsdk\b/i,
  /\bredistributable/i,
  /\bruntime\b/i,
  /\bupdate(r)?\b/i,
  /\bweb deploy\b/i,
  /\blanguage pack\b/i,
  /\bsoftware development kit\b/i,
  /\bvisual (c\+\+|studio) \d{4} (build tools|installer|redistributable)\b/i,
  /\b\.net (framework|runtime|sdk)\b/i,
  /\brepair\b/i,
  /\bdiagnostic(s)?\b/i,
  /\btroubleshoot(er)?\b/i,
  /\buser guide\b/i,
  /\bgetting started\b/i,
  /\bconfiguring\b/i,
  /\bwhat'?s new\b/i,
  /\bon the web\b/i,
  /\bshell extension\b/i,
  /\breset (preferences|settings)\b/i,
  /\bversion \d+(\.\d+)*$/i,
  /^(unins\d*|installer|setup|update|updater|tools?|saves?|folder|uninstall\w*|maintenance|reload configuration|configure\w*)$/i,
  /\.(txt|pdf|rtf|html?|url|md|chm|docx?|xlsx?|pptx?)$/i,
  /^\W*$/,
];

const JUNK_EXE = [
  /\\unins\d[^\\]*\.exe$/i,
  /\\uninstall[^\\]*\.exe$/i,
  /\\setup\.exe$/i,
  /\\installer\.exe$/i,
  /\\update(r)?\.exe$/i,
  /\\maintenancetool\.exe$/i,
  /\\vc_redist[^\\]*\.exe$/i,
  /\\dotnet[^\\]*\.exe$/i,
  /\\MicrosoftEdgeUpdate\.exe$/i,
];

/** Internal executables that are never a user's app, regardless of folder. */
const INTERNAL_EXE = new Set(["control.exe", "rundll32.exe", "mmc.exe", "hh.exe", "explorer.exe", "dllhost.exe"]);

const LAUNCHABLE_EXT = new Set([".exe", ".bat", ".cmd", ".lnk", ".msc", ".msra", ".appref-ms"]);

function isJunkName(name: string) {
  const trimmed = name.trim();
  return !trimmed || JUNK_NAME.some((re) => re.test(trimmed));
}

function isJunkExe(p: string | null | undefined) {
  if (!p) return false;
  if (JUNK_EXE.some((re) => re.test(p))) return true;
  // Bare internal tool executables living inside system folders.
  const lower = p.toLowerCase();
  const base = path.basename(lower);
  return (
    (lower.includes("\\windows\\system32\\") || lower.includes("\\windows\\syswow64\\")) &&
    INTERNAL_EXE.has(base)
  );
}


function normalizePath(p: string | null | undefined) {
  if (!p) return null;
  return p.replace(/"/g, "").replace(/\//g, "\\").replace(/\s+$/, "").toLowerCase();
}

function exeName(p: string | null | undefined) {
  if (!p) return null;
  const base = path.basename(p);
  return base || null;
}

async function walkShortcuts(root: string, source: "start-menu" | "desktop", depth = 0): Promise<{ path: string; name: string; source: "start-menu" | "desktop" }[]> {
  if (depth > 8) return [];
  let entries;
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: { path: string; name: string; source: "start-menu" | "desktop" }[] = [];
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "WindowsApps") continue;
      out.push(...(await walkShortcuts(full, source, depth + 1)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".lnk")) {
      out.push({ path: full, name: path.basename(entry.name, ".lnk"), source });
    }
  }
  return out;
}

function resolvesToUsable(target: string | null, targetType: string | null): boolean {
  if (!target) return false;
  const lower = target.toLowerCase();
  if (lower.includes("\\windows\\system32\\") && !/(notepad|calc|cmd|powershell|explorer|mspaint|snipping|charmap|control|regedit|taskmgr|magnify|osk|narrator|voiceaccess|dfrgui|cleanmgr)\.exe$/.test(lower)) {
    return false;
  }
  if (lower.includes("\\windows\\winsxs\\")) return false;
  if (lower.includes("\\windowsapps\\")) return false;
  if (targetType === ".url" || targetType === ".htm" || targetType === ".html" || targetType === ".pdf" || targetType === ".txt" || targetType === ".rtf" || targetType === ".chm" || targetType === ".docx") {
    return false;
  }
  return true;
}

function shorten(name: string) {
  return name.replace(/\s+-\s+shortcut$/i, "").trim();
}

/** "WizTree v4.33" / "App 1.2.3" -> "WizTree" / "App". */
function strippedName(name: string) {
  return name.replace(/\s+v?\d+(\.\d+){1,4}\s*(\(x64\)|64[- ]?bit|32[- ]?bit)?$/i, "").trim() || name;
}

/** UWP entries whose AppID is not a path or AUMID add nothing over Start-menu shortcuts. */
function isUsefulUwp(appsFolderId: string) {
  return (
    /^[A-Za-z]:\\/.test(appsFolderId) ||
    /_[a-z0-9]{13}!/i.test(appsFolderId) ||
    /^[a-z0-9]+(\.[a-z0-9-]+)+!/i.test(appsFolderId)
  );
}

function displayKey(name: string) {
  return name.toLowerCase().replace(/\s+(-|—|–)\s+shortcut$/, "").replace(/\s+/g, " ").trim();
}

function dedupeKey(app: Pick<DetectedApp, "executablePath" | "appsFolderId" | "shortcutPath" | "displayName">) {
  const exe = normalizePath(app.executablePath);
  if (exe && exe.endsWith(".exe")) return `exe:${exe}`;
  if (app.appsFolderId && /^[A-Za-z]:\\/.test(app.appsFolderId)) return `exe:${normalizePath(app.appsFolderId)}`;
  return `name:${displayKey(app.displayName)}`;
}

function makeId(key: string) {
  return crypto.createHash("sha1").update(key.toLowerCase()).digest("hex").slice(0, 16);
}

const SOURCE_RANK: Record<DetectedApp["source"], number> = {
  "start-menu": 0,
  desktop: 1,
  uwp: 2,
  registry: 3,
};

export interface ScanResult {
  apps: DetectedApp[];
}

export type ScanProgress = (patch: Partial<ScanState>) => void;

/**
 * Full discovery pass. Never touches user organization — that lives in the
 * frontend keyed by app id, and ids are derived from stable targets.
 */
export async function runScan(previous: DetectedApp[], progress: ScanProgress): Promise<DetectedApp[]> {
  const candidates: DetectedApp[] = [];
  const now = new Date().toISOString();

  progress({ phase: "Reading shortcuts", progress: 5 });
  const [startShortcuts, desktopShortcuts] = await Promise.all([
    walkShortcuts(START_MENU_USER, "start-menu").then(async (a) =>
      a.concat(await walkShortcuts(START_MENU_COMMON, "start-menu")),
    ),
    walkShortcuts(DESKTOP_USER, "desktop").then(async (a) => a.concat(await walkShortcuts(DESKTOP_PUBLIC, "desktop"))),
  ]);

  progress({ phase: "Resolving targets", progress: 20 });
  const shortcutItems = [...startShortcuts, ...desktopShortcuts];
  const resolved: ShortcutRecord[] = [];
  const CHUNK = 80;
  for (let i = 0; i < shortcutItems.length; i += CHUNK) {
    const chunk = shortcutItems.slice(i, i + CHUNK);
    const part = await resolveShortcuts(chunk);
    resolved.push(...part);
    progress({ progress: 20 + Math.round((i / Math.max(1, shortcutItems.length)) * 25) });
  }

  for (const rec of resolved) {
    const name = shorten(rec.name);
    if (!name || isJunkName(name)) continue;
    if (!resolvesToUsable(rec.target, rec.targetType)) continue;
    if (isJunkExe(rec.target)) continue;
    if (/(c\+\+|removal|preferences|uninstall|manual|checker|connection|help)/i.test(name)) continue;
    const target = rec.target && rec.targetType === ".exe" ? rec.target : null;
    candidates.push({
      id: "",
      name,
      displayName: name,
      executablePath: target,
      shortcutPath: rec.shortcutPath,
      appsFolderId: null,
      arguments: rec.arguments || null,
      workingDirectory: rec.workingDirectory || null,
      executableName: exeName(target),
      source: rec.source,
      installLocation: target ? path.dirname(target) : null,
      publisher: null,
      hasIcon: true,
      dateDetected: now,
      targetExists: rec.exists,
    });
  }

  progress({ phase: "Reading Start menu apps", progress: 50 });
  const uwp = await listUwp();
  void fsPromises;
  const [appx] = await Promise.all([listAppx().catch(() => [])]);
  const manifest: Record<string, { location: string; logo: string | null }> = {};
  for (const pkg of appx) {
    if (!pkg.packageFamilyName || !pkg.applicationId) continue;
    manifest[`${pkg.packageFamilyName}!${pkg.applicationId}`] = { location: pkg.installLocation, logo: pkg.logo };
  }
  try {
    await fsPromises.mkdir(dataDir(), { recursive: true });
    await fsPromises.writeFile(path.join(dataDir(), "manifests.json"), JSON.stringify(manifest), "utf8");
  } catch {
    /* non-fatal */
  }
  for (const entry of uwp) {
    const name = shorten(entry.name);
    if (!name || isJunkName(name)) continue;
    const afid = entry.appsFolderId;
    if (!afid) continue;
    if (!isUsefulUwp(afid)) continue;
    if (/^https?:/i.test(afid) || /\.(url|html?|pdf|txt|rtf|chm|jpg|png|mp4)$/i.test(afid)) continue;
    if (/^file:/i.test(afid)) continue;
    let executablePath: string | null = null;
    if (/^[A-Za-z]:\\/.test(afid)) {
      if (!LAUNCHABLE_EXT.has(path.extname(afid).toLowerCase()) && path.extname(afid) !== "") continue;
      if (isJunkExe(afid)) continue;
    // Plain single-token AppIDs (protocol handlers like "Brave", "MSEdge") add nothing.
    if (!/[!\\]/.test(afid)) continue;
      executablePath = path.extname(afid) === ".exe" ? afid : null;
      if (path.extname(afid) === ".bat" || path.extname(afid) === ".cmd" || path.extname(afid) === ".msc") {
        // still launchable via explorer/shell but not icon-extractable: drop
        continue;
      }
    }
    let exists = true;
    if (executablePath) {
      try {
        await fs.access(executablePath);
      } catch {
        exists = false;
      }
    }
    candidates.push({
      id: "",
      name,
      displayName: name,
      executablePath,
      shortcutPath: null,
      appsFolderId: afid,
      arguments: null,
      workingDirectory: executablePath ? path.dirname(executablePath) : null,
      executableName: exeName(executablePath),
      source: "uwp",
      installLocation: executablePath ? path.dirname(executablePath) : null,
      publisher: null,
      hasIcon: true,
      dateDetected: now,
      targetExists: exists,
    });
  }

  progress({ phase: "Reading installed programs", progress: 70 });
  let registry: RegistryRecord[] = [];
  try {
    registry = await listRegistry();
  } catch {
    registry = [];
  }
  for (const rec of registry) {
    const name = shorten(rec.displayName);
    if (!name || isJunkName(name)) continue;
    if (/clicktorun|office\d*\.?\d* - |package cache|visual studio (installer|build tools)|windows sdk|onedrive\w*setup/i.test(name + (rec.displayName ?? ""))) continue;
    const icon = rec.displayIcon ? rec.displayIcon.split(",")[0].replace(/"/g, "").trim() : null;
    if (!icon || path.extname(icon).toLowerCase() !== ".exe" || isJunkExe(icon)) continue;
    if (/\\(package cache|windowsapps)\\|\\common files\\microsoft shared\\/i.test(icon)) continue;
    let exists = true;
    try {
      await fs.access(icon);
    } catch {
      exists = false;
    }
    if (!exists) continue;
    candidates.push({
      id: "",
      name: strippedName(name),
      displayName: strippedName(name),
      executablePath: icon,
      shortcutPath: null,
      appsFolderId: null,
      arguments: null,
      workingDirectory: rec.installLocation && rec.installLocation.trim() ? rec.installLocation.trim() : path.dirname(icon),
      executableName: exeName(icon),
      source: "registry",
      installLocation: rec.installLocation ?? null,
      publisher: rec.publisher ?? null,
      hasIcon: true,
      dateDetected: now,
      targetExists: true,
    });
  }

  progress({ phase: "Merging results", progress: 90 });
  const previousById = new Map(previous.map((a) => [a.id, a]));
  const best = new Map<string, DetectedApp>();
  for (const c of candidates) {
    const key = dedupeKey(c);
    const existing = best.get(key);
    if (!existing) {
      best.set(key, c);
      continue;
    }
    // Prefer the more specific source, and keep richer metadata.
    const rank = SOURCE_RANK[c.source] - SOURCE_RANK[existing.source];
    if (rank < 0) {
      best.set(key, { ...c, arguments: c.arguments ?? existing.arguments });
    } else {
      existing.arguments ??= c.arguments;
      existing.publisher ??= c.publisher;
      existing.shortcutPath ??= c.shortcutPath;
    }
  }

  // A registry entry that duplicates a Start-menu app by name adds nothing.
  const namesFromShortcuts = new Set(
    candidates.filter((c) => c.source !== "registry").map((c) => displayKey(c.displayName)),
  );
  for (const [key, app] of [...best.entries()]) {
    if (app.source !== "registry") continue;
    const inBest = [...best.values()].some((other) => other !== app && other.source !== "registry" && displayKey(other.displayName) === displayKey(app.displayName));
    if (inBest || namesFromShortcuts.has(displayKey(app.displayName))) best.delete(key);
  }

  const apps: DetectedApp[] = [];
  for (const app of best.values()) {
    const key = dedupeKey(app);
    const id = makeId(key);
    if (apps.some((a) => a.id === id)) continue;
    const prev = previousById.get(id);
    apps.push({
      ...app,
      id,
      dateDetected: prev?.dateDetected ?? now,
    });
  }

  apps.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  return apps;
}

export type { UwpRecord };
