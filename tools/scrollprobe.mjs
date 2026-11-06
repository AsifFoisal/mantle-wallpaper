/** Diagnose wheel scrolling in panel body and settings window. */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const URL = process.env.MANTLE_URL ?? "http://127.0.0.1:7337/";
const token = readFileSync(process.env.LOCALAPPDATA + "/Mantle Wallpaper/token", "utf8").trim();

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
await p.goto(URL, { waitUntil: "domcontentloaded" });
// Pull the app list, assign ~30 apps to the utilities collection so its body overflows.
const apps = await p.evaluate(async (t) => {
  const res = await fetch("/api/apps", { headers: { "X-Mantle-Token": t } });
  const j = await res.json();
  return j.apps.map((a) => a.id);
}, token);
console.log("apps fetched:", apps.length);
await p.evaluate(() =>
  localStorage.setItem("mantle.v1", JSON.stringify({ onboardingDismissed: true })),
);
// Seed overrides via the page (zustand is not exposed; write raw state).
await p.evaluate((ids) => {
  const s = JSON.parse(localStorage.getItem("mantle.v1") ?? "{}");
  s.onboardingDismissed = true;
  s.appOverrides = {};
  for (const id of ids.slice(0, 30)) s.appOverrides[id] = { categories: ["utilities"], categoriesManual: true };
  s.panels = { utilities: { x: 40, y: 40, w: 360, h: 460, open: true, minimized: false, locked: false } };
  localStorage.setItem("mantle.v1", JSON.stringify(s));
}, apps);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(1800);

const body = p.locator("[data-floating-root='panel-utilities'] [data-panel-body] > div").first();
const scrollInfo = async () =>
  p.evaluate(() => {
    const el = document.querySelector("[data-floating-root='panel-utilities'] [data-panel-body] > div");
    if (!el) return null;
    return { sh: el.scrollHeight, ch: el.clientHeight, st: el.scrollTop, over: getComputedStyle(el).overflowY };
  });
console.log("panel scroll state:", await scrollInfo());
const before = (await scrollInfo())?.st ?? 0;
await body.hover({ position: { x: 100, y: 100 } }).catch(() => p.mouse.move(200, 300));
await p.mouse.wheel(0, 300);
await p.waitForTimeout(400);
const after = (await scrollInfo())?.st ?? 0;
console.log("panel wheel:", before, "->", after, after > before ? "SCROLLS" : "DEAD");

// Settings window
await p.locator("[data-floating-root='orb']").click();
await p.waitForTimeout(600);
const sec = p.locator("[data-floating-root='settings'] .min-w-0.flex-1").first();
const sInfo = async () =>
  p.evaluate(() => {
    const el = document.querySelector("[data-floating-root='settings'] .min-w-0.flex-1");
    if (!el) return null;
    return { sh: el.scrollHeight, ch: el.clientHeight, st: el.scrollTop };
  });
const s0 = (await sInfo())?.st ?? 0;
await sec.hover().catch(() => p.mouse.move(900, 400));
await p.mouse.wheel(0, 300);
await p.waitForTimeout(400);
const s1 = (await sInfo())?.st ?? 0;
console.log("settings wheel:", s0, "->", s1, s1 > s0 ? "SCROLLS" : "DEAD");
await b.close();
