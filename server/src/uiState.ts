import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { dataDir, ensureDir } from "./paths.js";

/**
 * Opaque snapshot of the frontend's user organization (collections, panel
 * geometry, dock, favourites…). The server stores it verbatim and never reads
 * into its shape — organization stays owned by the web half, so no rescan or
 * server logic can ever erase it.
 */
export interface UiStateEnvelope {
  /** Monotonic revision, bumped by the frontend on every push. */
  rev: number;
  /** Wall-clock ms when the frontend produced this snapshot. */
  savedAt: number;
  state: Record<string, unknown>;
}

const FILE = () => path.join(dataDir(), "ui-state.json");

export async function loadUiState(): Promise<UiStateEnvelope | null> {
  try {
    const raw = await fs.readFile(FILE(), "utf8");
    const parsed = JSON.parse(raw) as Partial<UiStateEnvelope>;
    if (
      typeof parsed.rev !== "number" ||
      typeof parsed.savedAt !== "number" ||
      typeof parsed.state !== "object" ||
      parsed.state === null
    ) {
      return null;
    }
    return { rev: parsed.rev, savedAt: parsed.savedAt, state: parsed.state as Record<string, unknown> };
  } catch {
    return null;
  }
}

/** Atomic write: temp file in the same dir, fsync, then rename over the target. */
export async function saveUiState(data: UiStateEnvelope): Promise<void> {
  await ensureDir(dataDir());
  const target = FILE();
  const tmp = `${target}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  const handle = await fs.open(tmp, "w");
  try {
    await handle.writeFile(JSON.stringify(data), "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fs.rename(tmp, target);
}
