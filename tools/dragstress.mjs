/** Stresses panel dragging across remount-triggering moments. */
import { chromium } from "playwright";
const URL = process.env.MANTLE_URL ?? "http://127.0.0.1:7337/";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const errs = [];
p.on("pageerror", (e) => errs.push(e.message.slice(0, 160)));
await p.goto(URL, { waitUntil: "domcontentloaded" });
await p.evaluate(() => localStorage.setItem("mantle.v1", JSON.stringify({
  onboardingDismissed: true,
  panels: { development: { x: 200, y: 120, w: 380, h: 460, open: true, minimized: false, locked: false } },
})));
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(1600);
const S = () => p.evaluate(() => JSON.parse(localStorage.getItem("mantle.v1")).panels.development);
const header = p.locator("[data-floating-root='panel-development'] [data-drag-handle]").first();
const out = [];
const ok = (n, v, d = "") => out.push(`${v ? "PASS" : "FAIL"}  ${n}${v ? "" : "  --  " + d}`);

// plain drag
async function drag(steps, dx, dy, { hurdle, button = "left" } = {}) {
  const hb = await header.boundingBox();
  await p.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await p.mouse.down({ button });
  for (let i = 1; i <= steps; i++) {
    await p.mouse.move(hb.x + hb.width / 2 + (dx * i) / steps, hb.y + hb.height / 2 + (dy * i) / steps);
    if (hurdle && i === Math.floor(steps / 2)) await hurdle();
    await p.waitForTimeout(12);
  }
  await p.mouse.up({ button });
  await p.waitForTimeout(500);
  return S();
}

const a = await drag(10, 150, 90);
ok("plain drag persists and stays open", a.open === true && a.x !== 200, JSON.stringify(a));

const r = await drag(10, -60, 40, {
  hurdle: async () => {
    // force a re-render storm mid-drag
    await p.evaluate(() => window.dispatchEvent(new Event("resize")));
  },
});
ok("drag survives re-render/resize mid-gesture", r.open === true, JSON.stringify(r));

const s = await drag(10, 40, 30, {
  hurdle: async () => {
    // open + close another collection mid-drag (different component tree churn)
    await p.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("mantle.v1"));
      s.panels.games = { x: 600, y: 300, w: 360, h: 400, open: true, minimized: false, locked: false };
      localStorage.setItem("mantle.v1", JSON.stringify(s));
    });
    await p.keyboard.press("Control+k");
    await p.keyboard.press("Escape");
  },
});
ok("drag survives UI churn mid-gesture", s.open === true, JSON.stringify(s));

// locked panel cannot drag
await p.evaluate(() => {
  const st = JSON.parse(localStorage.getItem("mantle.v1"));
  st.panels.development.locked = true;
  st.panels.development.open = true;
  localStorage.setItem("mantle.v1", JSON.stringify(st));
});
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(1500);
const before = await S();
const locked = await drag(8, 100, 100);
ok("locked panel ignores drag", locked.x === before.x && locked.y === before.y && locked.open, JSON.stringify(locked));

console.log(out.join("\n"));
console.log(`\n${out.filter((r2) => r2.startsWith("PASS")).length}/${out.length} passed`);
if (errs.length) console.log("errors:", errs.slice(0, 4));
await b.close();
