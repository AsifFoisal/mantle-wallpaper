import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { getToken, requireToken } from "./auth.js";
import { getData, getScanState, scanNow, scanInProgress } from "./store.js";
import { loadUiState, saveUiState } from "./uiState.js";
import { iconPathFor } from "./icons.js";
import { launchApp } from "./launcher.js";
import { runningProcesses } from "./processes.js";
import { listWindows, windowAction } from "./windows.js";
import { APP_VERSION, dataDir, webDistDir } from "./paths.js";
import { startScanScheduler } from "./scheduler.js";

export interface ServerOptions {
  port?: number;
  devOrigin?: string;
  autoScan?: boolean;
}

const ALLOWED_PORT = 7337;

const ALLOWED_ORIGINS = [
  `http://127.0.0.1:${ALLOWED_PORT}`,
  `http://localhost:${ALLOWED_PORT}`,
  "http://127.0.0.1:5173",
  "http://localhost:5173",
];

export async function createApp(options: ServerOptions = {}): Promise<Express> {
  const token = await getToken();
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", false);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "blob:"],
          fontSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
          mediaSrc: ["'self'", "blob:", "data:"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "same-origin" },
      frameguard: false,
      referrerPolicy: { policy: "no-referrer" },
    }),
  );

  app.use(
    cors({
      origin(origin, callback) {
        // Same-origin requests have no Origin header; browsers send it for cross-origin.
        if (!origin) return callback(null, false);
        if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
        callback(null, false);
      },
      credentials: false,
      methods: ["GET", "POST", "PUT", "OPTIONS"],
      allowedHeaders: ["Content-Type", "X-Mantle-Token"],
      maxAge: 600,
    }),
  );

  app.use(express.json({ limit: "64kb", strict: true }));

  // UI-state sync: the wallpaper mirrors its user organization here so settings
  // survive the embedded browser wiping its profile (Lively restarts CEF).
  // Custom icons ride along as data URLs, so this route parses its own, larger
  // body before the global 64kb JSON parser runs. The state itself is opaque:
  // validated only as an envelope, never opened.
  const uiStateSchema = z
    .object({
      rev: z.number().int().min(0),
      savedAt: z.number().int().min(0),
      state: z.record(z.string(), z.unknown()),
    })
    .strict();

  app.put("/api/ui-state", requireToken(token), express.json({ limit: "8mb" }), async (req, res, next) => {
    try {
      const parsed = uiStateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_request" });
      const stored = await loadUiState();
      // Monotonic revisions: a laggard tab may not overwrite a newer snapshot.
      if (stored && parsed.data.rev < stored.rev) {
        return res.status(409).json({ error: "stale_rev", rev: stored.rev });
      }
      await saveUiState(parsed.data);
      res.json({ saved: true });
    } catch (err) {
      next(err);
    }
  });

  // Request log (in-memory ring). Lets the user confirm the wallpaper is really
  // hitting the API from inside Lively/CEF, which has no devtools by default.
  const recent: { t: string; method: string; path: string; ua: string; origin: string | null; status: number }[] = [];
  app.use("/api", (req, res, next) => {
    if (req.path === "/system/requests") return next();
    const entry = {
      t: new Date().toISOString(),
      method: req.method,
      path: req.originalUrl.slice(0, 120),
      ua: String(req.headers["user-agent"] ?? "").slice(0, 80),
      origin: typeof req.headers.origin === "string" ? req.headers.origin : null,
      status: 0,
    };
    res.on("finish", () => {
      entry.status = res.statusCode;
      recent.push(entry);
      if (recent.length > 300) recent.shift();
    });
    next();
  });

  // Token handshake for the dev server. Browsers can't read the response unless
  // the origin is on the CORS allowlist; non-browser clients are fine (they can
  // read the token file and are local by definition).
  app.get("/api/system/requests", (_req, res) => {
    res.json({ requests: recent.slice(-100).reverse() });
  });

  app.get("/api/bootstrap", (_req, res) => {
    res.json({ token, version: APP_VERSION });
  });

  // API
  app.use("/api", requireToken(token));

  app.get("/api/system/status", async (_req, res, next) => {
    try {
      const data = await getData();
      const scan = getScanState();
      res.json({
        ok: true,
        version: APP_VERSION,
        platform: process.platform,
        scanning: scan.scanning,
        phase: scan.phase,
        progress: scan.progress,
        lastScanAt: data.lastScanAt,
        appCount: data.apps.length,
        newCount: scan.newCount,
        error: scan.error,
      });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/ui-state", async (_req, res, next) => {
    try {
      const stored = await loadUiState();
      res.json(stored ?? { rev: 0, savedAt: 0, state: null });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/apps", async (_req, res, next) => {    try {
      const data = await getData();
      res.json({ apps: data.apps, lastScanAt: data.lastScanAt });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/apps/:id", async (req, res, next) => {
    try {
      const data = await getData();
      const app = data.apps.find((a) => a.id === req.params.id);
      if (!app) return res.status(404).json({ error: "not_found" });
      res.json(app);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/apps/scan", async (_req, res) => {
    if (scanInProgress()) return res.json({ started: false, scanning: true });
    void scanNow().catch(() => undefined);
    res.json({ started: true, scanning: true });
  });

  const launchSchema = z.object({ id: z.string().min(8).max(64).regex(/^[a-f0-9]+$/) }).strict();

  app.post("/api/apps/launch", async (req, res) => {
    const parsed = launchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_request", message: "Body must contain only a valid app id." });
    const data = await getData();
    const outcome = await launchApp(data.apps, parsed.data.id);
    if (!outcome.launched) return res.status(409).json({ error: "launch_failed", message: outcome.reason ?? "Could not launch" });
    res.json({ launched: true });
  });

  const runningSchema = z.object({ ids: z.array(z.string().max(64)).max(1000) }).strict();

  app.post("/api/apps/running", async (req, res) => {
    const parsed = runningSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_request" });
    const data = await getData();
    const procs = await runningProcesses();
    const running = data.apps
      .filter((a) => parsed.data.ids.includes(a.id))
      .filter((a) => {
        const exe = a.executableName?.toLowerCase();
        return Boolean(exe && (procs.has(exe) || procs.has(exe.replace(/\.exe$/, ""))));
      })
      .map((a) => a.id);
    res.json({ running });
  });

  // Taskbar: window enumeration + minimize/restore, all validated and
  // hwnd-scoped — no process handles, no shell strings.
  app.get("/api/windows", async (_req, res) => {
    res.json({ windows: await listWindows() });
  });

  const windowActionSchema = z
    .object({
      action: z.enum(["minimize", "restore"]),
      hwnd: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    })
    .strict();

  app.post("/api/windows/action", async (req, res) => {
    const parsed = windowActionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_request", message: "Body must be { action, hwnd }." });
    const ok = await windowAction(parsed.data.action, parsed.data.hwnd);
    if (!ok) return res.status(409).json({ error: "action_failed", message: "Window could not be manipulated." });
    res.json({ ok: true });
  });

  // Icons: served same-origin in production. In dev the Vite proxy forwards the
  // cookie, or the frontend falls back to ?token=.
  app.get("/api/icons/:id", async (req, res, next) => {
    try {
      const data = await getData();
      const app = data.apps.find((a) => a.id === req.params.id);
      if (!app) return res.status(404).end();
      const file = await iconPathFor(app);
      if (!file) return res.status(404).end();
      const bytes = await fs.readFile(file);
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'");
      res.end(bytes);
    } catch (err) {
      next(err);
    }
  });

  // Appearance storage for the wallpaper image (kept off localStorage quota limits)
  const dist = webDistDir();

  app.get("/api/appearance/background", async (_req, res, next) => {
    try {
      const file = path.join(dataDir(), "background");
      const bytes = await fs.readFile(file);
      // Sniff the magic bytes rather than trusting the upload's content type.
      const head = bytes.subarray(0, 12);
      const mime = head[0] === 0x89
        ? "image/png"
        : head[0] === 0xff && head[1] === 0xd8
          ? "image/jpeg"
          : head.subarray(0, 4).toString("ascii") === "RIFF" && head.subarray(8, 12).toString("ascii") === "WEBP"
            ? "image/webp"
            : head.subarray(0, 3).toString("ascii") === "GIF"
              ? "image/gif"
              : "application/octet-stream";
      res.setHeader("Content-Type", mime);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "no-cache");
      res.end(bytes);
    } catch {
      next();
    }
  });

  app.post("/api/appearance/background", express.raw({ type: ["image/*", "application/octet-stream"], limit: "16mb" }), async (req, res) => {
    const body = req.body as Buffer;
    if (!Buffer.isBuffer(body) || body.length === 0) return res.status(400).json({ error: "invalid_image" });
    const isPng = body.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const isJpg = body[0] === 0xff && body[1] === 0xd8;
    const isWebp = body.subarray(0, 4).toString("ascii") === "RIFF" && body.subarray(8, 12).toString("ascii") === "WEBP";
    const isGif = body.subarray(0, 3).toString("ascii") === "GIF";
    if (!isPng && !isJpg && !isWebp && !isGif) return res.status(415).json({ error: "unsupported_image", message: "PNG, JPEG, WebP or GIF only." });
    await fs.mkdir(dataDir(), { recursive: true });
    await fs.writeFile(path.join(dataDir(), "background"), body);
    res.json({ saved: true, bytes: body.length });
  });

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "not_found" });
  });

  // Static frontend with token cookie + inline token injection.
  app.use(
    express.static(dist, {
      index: false,
      setHeaders(res, filePath) {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    }),
  );

  app.get(/.*/, async (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api/")) return next();
    try {
      const html = await fs.readFile(path.join(dist, "index.html"), "utf8");
      const injected = html.replace(
        "<head>",
        `<head>\n    <script>window.__MANTLE_TOKEN__=${JSON.stringify(token)};</script>`,
      );
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Set-Cookie", `mantle_session=${token}; HttpOnly; SameSite=Strict; Path=/`);
      res.end(injected);
    } catch {
      res
        .status(503)
        .type("html")
        .end(
          `<!doctype html><html><body style="background:#060709;color:#c9cad0;font:13px system-ui;display:grid;place-items:center;height:100vh;margin:0"><div style="text-align:center;max-width:420px"><div style="font-size:11px;letter-spacing:.3em;text-transform:uppercase;opacity:.5">Mantle</div><p style="margin-top:12px;line-height:1.6">The wallpaper bundle has not been built yet.<br><code style="opacity:.7">npm run build</code></p></div></body></html>`,
        );
    }
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[mantle] error", err);
    if (res.headersSent) return;
    res.status(500).json({ error: "server_error" });
  });

  if (options.autoScan !== false) {
    startScanScheduler();
  }

  return app;
}

export async function startServer(options: ServerOptions = {}) {
  const port = options.port ?? ALLOWED_PORT;
  const app = await createApp(options);
  return new Promise<import("node:http").Server>((resolve, reject) => {
    const server = app
      .listen(port, "127.0.0.1", () => {
        console.log(`[mantle] companion ready at http://127.0.0.1:${port}/`);
        resolve(server);
      })
      .on("error", reject);
  });
}
