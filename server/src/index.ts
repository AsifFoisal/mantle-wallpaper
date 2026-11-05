import { startServer } from "./app.js";
import { dataDir } from "./paths.js";
import fs from "node:fs";
import path from "node:path";

process.on("unhandledRejection", (err) => {
  console.error("[mantle] unhandled rejection", err);
});

process.on("uncaughtException", (err) => {
  console.error("[mantle] uncaught exception", err);
});

/** One-time rename migration: pre-rename data lived under "Nexus Wallpaper". */
function migrateLegacyDataDir() {
  const base = process.env.LOCALAPPDATA;
  if (!base) return;
  const legacy = path.join(base, "Nexus Wallpaper");
  const target = dataDir();
  if (fs.existsSync(target) || !fs.existsSync(legacy)) return;
  try {
    fs.cpSync(legacy, target, { recursive: true });
    console.log(`[mantle] migrated data from ${legacy}`);
  } catch (err) {
    console.error("[mantle] legacy data migration failed:", err instanceof Error ? err.message : err);
  }
}

async function main() {
  if (process.env.MANTLE_DATA_DIR) {
    process.env.LOCALAPPDATA = process.env.MANTLE_DATA_DIR;
  }
  migrateLegacyDataDir();
  const port = Number(process.env.MANTLE_PORT ?? 7337);
  console.log(`[mantle] data directory: ${dataDir()}`);
  await startServer({
    port,
    autoScan: process.env.MANTLE_NO_AUTOSCAN !== "1",
  });
}

void main().catch((err) => {
  console.error("[mantle] failed to start:", err);
  process.exit(1);
});
