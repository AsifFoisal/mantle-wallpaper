/** End-to-end: settings survive a wiped browser profile via the companion. */
import { chromium } from "playwright";
const URL = process.env.MANTLE_URL ?? "http://127.0.0.1:7337/";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const out = [];
const ok = (n, v, d = "") => out.push(`${v ? "PASS" : "FAIL"}  ${n}${v ? "" : "  --  " + d}`);

const panels = () => p.evaluate(() => JSON.parse(localStorage.getItem("mantle.v1") ?? "null")?.panels?.development ?? null);

// 1. Seed a pre-sync-style snapshot (no sync metadata) — it must win and be backed up.
await p.goto(URL, { waitUntil: "domcontentloaded" });
await p.evaluate(() => localStorage.setItem("mantle.v1", JSON.stringify({
  onboardingDismissed: true,
  panels: { development: { x: 123, y: 45, w: 380, h: 460, open: true, minimized: false, locked: false } },
})));
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(2500); // push debounce is 1200ms
const stored = await p.evaluate(async () => {
  const t = await (await fetch("/api/bootstrap")).json();
  const r = await fetch("/api/ui-state", { headers: { "X-Mantle-Token": t.token } });
  return r.json();
});
ok("local snapshot backed up to companion", stored?.state?.panels?.development?.x === 123, JSON.stringify(stored).slice(0, 160));

// 2. THE FAILURE CASE: Lively wipes the browser profile entirely.
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(2500); // reconcile + hydrate
const restored = await panels();
ok("wiped profile restores from companion", restored?.x === 123 && restored?.open === true, JSON.stringify(restored));

// 3. A live change flows through: open the panel's drag → persist a new position via the store.
await p.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("mantle.v1"));
  s.panels.development = { x: 300, y: 150, w: 380, h: 460, open: true, minimized: false, locked: false };
  localStorage.setItem("mantle.v1", JSON.stringify(s));
});
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(1500);
const header = p.locator("[data-floating-root='panel-development'] [data-drag-handle]").first();
const hb = await header.boundingBox();
await p.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
await p.mouse.down();
await p.mouse.move(hb.x + 150, hb.y + hb.height / 2 + 100, { steps: 8 });
await p.mouse.up();
await p.waitForTimeout(2200);
const afterDrag = await p.evaluate(async () => {
  const t = await (await fetch("/api/bootstrap")).json();
  const r = await fetch("/api/ui-state", { headers: { "X-Mantle-Token": t.token } });
  return (await r.json())?.state?.panels?.development ?? null;
});
ok("live drag persisted to companion", afterDrag && Math.abs(afterDrag.x - 450) < 6 && Math.abs(afterDrag.y - 250) < 6, JSON.stringify(afterDrag));

// 4. Wipe again → the dragged position (not the old seed) comes back.
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(2500);
const restored2 = await panels();
ok("second wipe restores dragged position", restored2 && Math.abs(restored2.x - 450) < 6, JSON.stringify(restored2));

// 5. Sync metadata now exists locally for future boots.
const meta = await p.evaluate(() => localStorage.getItem("mantle.v1.sync"));
ok("sync metadata present", Boolean(meta), String(meta));

console.log(out.join("\n"));
console.log(`\n${out.filter((r) => r.startsWith("PASS")).length}/${out.length} passed`);
await b.close();
process.exit(out.some((r) => r.startsWith("FAIL")) ? 1 : 0);
