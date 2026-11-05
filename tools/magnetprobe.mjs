/** Verifies the dock magnetic hover + that dock dragging still works. */
import { chromium } from "playwright";
const URL = process.env.MANTLE_URL ?? "http://127.0.0.1:7337/";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const out = [];
const ok = (n, v, d = "") => out.push(`${v ? "PASS" : "FAIL"}  ${n}${v ? "" : "  --  " + d}`);

await p.goto(URL, { waitUntil: "domcontentloaded" });
// Pin two real apps into the dock so there are icons to hover.
const ids = await p.evaluate(async () => {
  const t = await (await fetch("/api/bootstrap")).json();
  const r = await fetch("/api/apps", { headers: { "X-Mantle-Token": t.token } });
  const j = await r.json();
  return j.apps.slice(0, 2).map((a) => a.id);
});
await p.evaluate((ids) => {
  const s = JSON.parse(localStorage.getItem("mantle.v1"));
  s.onboardingDismissed = true;
  s.dock = { ...(s.dock ?? {}), appIds: ids, magnification: true, locked: false };
  localStorage.setItem("mantle.v1", JSON.stringify(s));
}, ids);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(1500);

const items = () => p.locator("[data-dock-item]");
const count = await items().count();
ok("dock items present", count >= 2, `count=${count}`);
if (count < 2) { console.log(out.join("\n")); await b.close(); process.exit(1); }

const styles = (i) => p.evaluate((i) => {
  const el = document.querySelectorAll("[data-dock-item]")[i];
  const s = el.style;
  return { transform: s.transform, shadow: s.boxShadow, sheen: s.getPropertyValue("--sheen-o") };
}, i);

const firstIcon = p.locator("button[data-dock-item][draggable]").first();
const bb = await firstIcon.boundingBox();
const cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2;
await p.mouse.move(cx, cy, { steps: 4 });
await p.waitForTimeout(120);
const idx = await firstIcon.evaluate((el) => [...document.querySelectorAll("[data-dock-item]")].indexOf(el));
const h0 = await styles(idx);
ok("hovered icon scales up", /scale\(1\.(1[5-9]|2\d)/.test(h0.transform), h0.transform);
ok("hovered icon gets shadow", h0.shadow.includes("rgb"), h0.shadow);
ok("sheen lights up", parseFloat(h0.sheen) > 0.5, h0.sheen);

const h1 = await styles(idx + 1);
const m0 = /scale\(([\d.]+)\)/.exec(h0.transform)?.[1], m1 = /scale\(([\d.]+)\)/.exec(h1.transform)?.[1];
ok("neighbour falls off smoothly", m1 && parseFloat(m1) < parseFloat(m0), `${m0} vs ${m1}`);

// Move away → springy reset to no inline transform
await p.mouse.move(cx, cy - 160, { steps: 4 });
await p.waitForTimeout(700);
const rest = await styles(idx + 1);
ok("styles reset on leave", rest.transform === "" && rest.shadow === "" && parseFloat(rest.sheen || "0") === 0, JSON.stringify(rest));

// Dock drag still works: press the `;;;` grip on the left edge of the dock.
// Scoped to the dock — the clock has its own grip higher up the page.
const dockBox = await p.locator("[data-floating-root='dock'] [data-drag-handle]").first().boundingBox();
const dockBefore = await p.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("mantle.v1"));
  return { x: s.dock.x, y: s.dock.y };
});
const px = dockBox.x + dockBox.width / 2, py = dockBox.y + dockBox.height / 2;
await p.mouse.move(px, py);
await p.mouse.down();
await p.mouse.move(px + 80, py - 48, { steps: 6 });
const dragging = await p.evaluate(() => document.body.classList.contains("is-dragging"));
await p.mouse.up();
await p.waitForTimeout(400);
const dockAfter = await p.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("mantle.v1"));
  return { x: s.dock.x, y: s.dock.y };
});
ok("dock drag engaged", dragging, "is-dragging not set");
ok("dock drag moved it", dockAfter.x !== dockBefore.x || dockAfter.y !== dockBefore.y, JSON.stringify({ dockBefore, dockAfter }));
ok("magnet reset during dock drag", await p.evaluate(() => [...document.querySelectorAll("[data-dock-item]")].every((el) => el.style.transform === "")));

// Rail click still opens a panel (interaction integrity)
const railBtn = p.locator("button[data-dock-item]:not([draggable])").first();
if (await railBtn.count()) {
  await railBtn.click();
  await p.waitForTimeout(500);
  const opened = await p.evaluate(() => Object.values(JSON.parse(localStorage.getItem("mantle.v1")).panels).some((pl) => pl.open));
  ok("rail click still opens panel", opened);
}

console.log(out.join("\n"));
console.log(`\n${out.filter((r) => r.startsWith("PASS")).length}/${out.length} passed`);
await b.close();
process.exit(out.some((r) => r.startsWith("FAIL")) ? 1 : 0);
