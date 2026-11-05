/** Measures whether a dragged panel visually follows the cursor 1:1. */
import { chromium } from "playwright";
const URL = process.env.MANTLE_URL ?? "http://127.0.0.1:7337/";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
await p.goto(URL, { waitUntil: "domcontentloaded" });
await p.evaluate(() => localStorage.setItem("mantle.v1", JSON.stringify({
  onboardingDismissed: true,
  panels: { development: { x: 300, y: 150, w: 380, h: 460, open: true, minimized: false, locked: false } },
})));
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(1600);

const rect = () => p.evaluate(() => {
  const r = document.querySelector("[data-floating-root='panel-development']").getBoundingClientRect();
  return { x: r.x, y: r.y };
});
// also read the slot (wrapper) position
const slot = () => p.evaluate(() => {
  const r = document.querySelector("[data-floating-slot='panel-development']").getBoundingClientRect();
  return { x: r.x, y: r.y };
});

const before = await rect();
console.log("before rect:", before, "slot:", await slot());

const hb = await p.locator("[data-floating-root='panel-development'] [data-drag-handle]").first().boundingBox();
const gx = hb.x + hb.width / 2, gy = hb.y + hb.height / 2;
await p.mouse.move(gx, gy);
await p.mouse.down();
// move +100,+60 in steps, sampling along the way
for (let i = 1; i <= 5; i++) {
  await p.mouse.move(gx + 20 * i, gy + 12 * i);
  await p.waitForTimeout(30);
  console.log(`step ${i}: mouse +${20 * i},+${12 * i}  rect:`, await rect());
}
await p.mouse.up();
await p.waitForTimeout(400);
const after = await rect();
console.log("after rect:", after, "delta:", { dx: Math.round(after.x - before.x), dy: Math.round(after.y - before.y) }, "expected: +100,+60");
const st = await p.evaluate(() => JSON.parse(localStorage.getItem("mantle.v1")).panels.development);
console.log("persisted:", { x: st.x, y: st.y });
await b.close();
