import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { dataDir, ensureDir, iconsDir } from "./paths.js";
import { extractIcon, findAppxLogo } from "./scripts.js";
import type { DetectedApp } from "./types.js";

const inflight = new Map<string, Promise<string | null>>();

function iconKey(app: DetectedApp) {
  const basis = app.executablePath ?? app.appsFolderId ?? app.shortcutPath ?? app.name;
  return crypto.createHash("sha1").update(basis.toLowerCase()).digest("hex").slice(0, 24);
}

/**
 * Returns a PNG path for the app's icon, extracting on first request.
 * Extraction runs in PowerShell + System.Drawing and is cached on disk.
 */
export async function iconPathFor(app: DetectedApp): Promise<string | null> {
  const key = iconKey(app);
  const dir = path.join(iconsDir(), key);
  const target = path.join(dir, "128.png");
  try {
    await fs.access(target);
    return target;
  } catch {
    /* not cached */
  }
  const existing = inflight.get(key);
  if (existing) return existing;

  const work = (async () => {
    await ensureDir(dir);
    let source: string | null = null;
    if (app.executablePath) source = app.executablePath;
    else if (app.appsFolderId && /^[A-Za-z]:\\/.test(app.appsFolderId)) source = app.appsFolderId;
    else if (app.shortcutPath) source = app.shortcutPath;

    const writeAll = async (targetPath: string) => {
      const sizes = await extractIcon(targetPath, dir);
      if (!sizes.length) return null;
      const best = sizes.includes(128) ? "128.png" : sizes.includes(64) ? "64.png" : sizes.includes(32) ? "32.png" : "256.png";
      const bestPath = path.join(dir, best);
      if (best !== "128.png") {
        try {
          await fs.copyFile(bestPath, target);
          return target;
        } catch {
          return bestPath;
        }
      }
      return bestPath;
    };

    if (source) {
      const done = await writeAll(source);
      if (done) return done;
    }

    if (app.appsFolderId) {
      // Packaged app: use the logo asset declared in its install manifest.
      try {
        const manifest = JSON.parse(await fs.readFile(path.join(dataDir(), "manifests.json"), "utf8")) as Record<
          string,
          { location: string; logo: string | null }
        >;
        const entry = manifest[app.appsFolderId];
        if (entry?.location && entry.logo) {
          const logo = await findAppxLogo(entry.location, entry.logo);
          if (logo) return await writeAll(logo);
        }
      } catch {
        /* no manifest cache */
      }
    }
    return null;
  })().finally(() => inflight.delete(key));

  inflight.set(key, work);
  return work;
}

export async function clearIconCache() {
  try {
    await fs.rm(iconsDir(), { recursive: true, force: true });
  } catch {
    /* noop */
  }
}

export { dataDir };
