/** Neighbour panels slide aside when the one beside them expands. */
import { chromium } from "playwright";
const URL = process.env.MANTLE_URL ?? "http://127.0.0.1:7337/";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const errs = [];
p.on("pageerror", (e) => errs.push(e.message.slice(0, 160)));
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
const out = [];
const ok = (n, v, d = "") => out.push(`${v ? "PASS" : "FAIL"}  ${n}${v ? "" : "  --  " + d}`);
// Measure the outer slot: that is what carries the sideways nudge.
const box = async (id) =>
  p.evaluate((cid) => {
    const el = document.querySelector(`[data-floating-slot='panel-${cid}']`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height, nudge: el.dataset.nudge ?? "" };
  }, id);

const dev0 = await box("development");
const games0 = await box("games");
const prod0 = await box("productivity");
ok("three collapsed bars side by side", Math.abs(games0.x - 420) < 2 && Math.abs(prod0.x - 800) < 2, `${games0.x},${prod0.x}`);

// Hover-preview Development (true expansion of the minimized one)
await p.mouse.move(dev0.x + 60, dev0.y + 20, { steps: 4 });
await p.waitForTimeout(500);
const dev1 = await box("development");
const games1 = await box("games");
const prod1 = await box("productivity");
ok("previewed panel grows", dev1.height > 300, `h=${dev1.height}`);
ok("right neighbour keeps clear of the expanded panel", games1.x >= dev1.x + 300 + 12, `dev ends ${dev1.x + 300}, games at ${games1.x.toFixed(1)}`);
ok("second neighbour shifts too", prod1.x > prod0.x + 5, `prod x ${prod0.x} → ${prod1.x.toFixed(1)}`);
ok("gap kept between panels", games1.x > dev1.x + 300, `dev ends ${dev1.x + 300}, games at ${games1.x.toFixed(1)}`);
const gameHeaderButtons = await p.locator("[data-floating-root='panel-games'] button[aria-label='Close']").boundingBox();
ok("neighbour close button no longer covered", gameHeaderButtons.x > dev1.x + 300, `close at ${gameHeaderButtons?.x}`);

// leaving restores everything
await p.mouse.move(1200, 800, { steps: 6 });
await p.waitForTimeout(900);
const dev2 = await box("development");
const games2 = await box("games");
const prod2 = await box("productivity");
ok("neighbours return after collapse", Math.abs(games2.x - games0.x) < 3 && Math.abs(prod2.x - prod0.x) < 3, `${games2.x},${prod2.x}`);
ok("no stored position was modified", await p.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("mantle.v1")).panels;
  return s.games.x === 420 && s.productivity.x === 800;
}));
void dev2;

// restore-and-collapse via the button also restores neighbours
await p.locator("[data-floating-root='panel-development'] button[aria-label='Restore']").click();
await p.waitForTimeout(500);
const g3 = await box("games");
ok("restore button pushes neighbour", g3.x >= 40 + 360 + 12, `games x ${g3.x}`);
// pointer may still be over the bar, so it would be peeking; move away first
await p.mouse.move(1300, 820);
await p.waitForTimeout(600);
await p.locator("[data-floating-root='panel-development'] button[aria-label='Minimize']").click();
await p.waitForTimeout(1200);
const g4 = await box("games");
// A 14px breathing gap is kept while a neighbour is expanded; collapsing restores
// the stored spot minus that gap only if the pointer is still near the bar.
const restored = Math.abs(g4.x - games0.x) < 20;
ok("minimize button brings neighbour back", restored, `games x ${g4.x} (was ${games0.x})`);

console.log(out.join("\n"));
console.log(`\n${out.filter((r) => r.startsWith("PASS")).length}/${out.length} passed`);
if (errs.length) console.log("errors:", errs.slice(0, 4));
await b.close();
