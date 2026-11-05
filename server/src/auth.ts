import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { dataDir, ensureDir } from "./paths.js";

let token: string | null = null;
const TOKEN_FILE = () => path.join(dataDir(), "token");

/** Loads (or creates) the shared secret that the wallpaper sends with each API call. */
export async function getToken(): Promise<string> {
  if (token) return token;
  await ensureDir(dataDir());
  try {
    const existing = (await fs.readFile(TOKEN_FILE(), "utf8")).trim();
    if (/^[a-f0-9]{64}$/.test(existing)) {
      token = existing;
      return token;
    }
  } catch {
    /* mint */
  }
  token = crypto.randomBytes(32).toString("hex");
  await fs.writeFile(TOKEN_FILE(), token, { mode: 0o600, encoding: "utf8" });
  return token;
}

export function tokensEqual(a: string | undefined, b: string): boolean {
  if (!a) return false;
  const ca = Buffer.from(a);
  const cb = Buffer.from(b);
  if (ca.length !== cb.length) return false;
  return crypto.timingSafeEqual(ca, cb);
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Every /api call needs the token from the X-Mantle-Token header. The server
 * also drops an httpOnly session cookie on page load so <img> requests for
 * icons are authenticated. CORS is separately restricted to localhost origins.
 */
export function requireToken(expected: string) {
  return (req: { method: string; headers: Record<string, unknown>; path?: string }, res: { status: (n: number) => { json: (b: unknown) => void } }, next: () => void) => {
    if (req.method !== "OPTIONS" && !expected) return next();
    const header = req.headers["x-mantle-token"];
    const headerValue = typeof header === "string" ? header : Array.isArray(header) ? header[0] : undefined;
    if (tokensEqual(headerValue, expected)) return next();
    // Same-origin cookie path (icons and dev proxy after the bootstrap handshake).
    const cookie = req.headers.cookie;
    // Dev-server icon requests carry the token as a query parameter.
    const query = req as unknown as { query?: { t?: unknown } };
    if (typeof query.query?.t === "string" && tokensEqual(query.query.t, expected)) return next();
    if (typeof cookie === "string") {
      const m = /(?:^|;\s*)mantle_session=([a-f0-9]{64})/.exec(cookie);
      if (m && tokensEqual(m[1], expected)) return next();
    }
    res.status(401).json({ error: "unauthorized", message: "Missing or invalid Mantle token." });
  };
}

export { SAFE_METHODS };
