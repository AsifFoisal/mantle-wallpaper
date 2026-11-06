/** Dead-zone map across a minimized panel bar. */
import { chromium } from "playwright";
const URL = process.env.MANTLE_URL ?? "http://127.0.0.1:7337/";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
await p.goto(URL, { waitUntil: "domcontentloaded" });
await p.evaluate(() =>
  localStorage.setItem("mantle.v1", JSON.stringify({
    onboardingDismissed: true,
    panels: {
      development: { x: 40, y: 40, w: 360, h: 460, open: true, minimized: true, locked: false },
      games: { x: 420, y: 40, w: 360, h: 460, open: true, minimized: true, locked: false },
      productivity: { x: 800, y: 40, w: 360, h: 460, open: true, minimized: true, locked: false },
    },
  })),
);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(1600);
await p.mouse.move(1400, 850);
await p.waitForTimeout(900);

const rows = [];
for (let y = 44; y <= 94; y += 10) {
  const row = [];
  for (let x = 44; x <= 336; x += 12) {
    await p.mouse.move(x, y, { steps: 2 });
    await p.waitForTimeout(120);
    const h = await p.evaluate(() => document.querySelector("[data-floating-slot='panel-development']")?.getBoundingClientRect().height ?? -1);
    row.push(h > 100 ? "#" : ".");
  }
  rows.push(`y=${String(y).padStart(3)} ${row.join("")}`);
}
console.log(rows.join("\n"));
console.log("( # = peeked open, . = still collapsed )");
await b.close();
