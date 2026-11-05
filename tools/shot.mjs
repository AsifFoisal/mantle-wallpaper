/**
 * Scripted UI screenshots (dev only). Small JPEGs keep tool results light.
 * Usage: node tools/shot.mjs <scenario>
 */
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const URL = process.env.MANTLE_URL ?? "http://127.0.0.1:5173/";
const scenario = process.argv[2] ?? "idle";
const out = `tools/shots/${scenario}.jpg`;
fs.mkdirSync(path.dirname(out), { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const logs = [];
page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && logs.push(`[${m.type()}] ${m.text().slice(0, 300)}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message.slice(0, 300)}`));

async function reset(mutator) {
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.evaluate((src) => {
    localStorage.removeItem("mantle.v1");
    // seed a deterministic layout
    localStorage.setItem("mantle.v1", JSON.stringify({ onboardingDismissed: true }));
    const s = JSON.parse(localStorage.getItem("mantle.v1"));
    s.settings = { username: "Asif", animationEnabled: true };
    new Function("s", src)(s);
    localStorage.setItem("mantle.v1", JSON.stringify(s));
  }, mutator ?? "");
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1600);
}

if (scenario === "idle") await reset("");
else if (scenario === "panels")
  await reset(`s.panels = { games: {x:120,y:140,w:360,h:420,open:true,locked:false}, development: {x:520,y:180,w:360,h:460,open:true,locked:false}, media: {x:-520,y:120,w:360,h:380,open:true,locked:false} };`);
else if (scenario === "settings") {
  await reset("");
  await page.getByRole("button", { name: "Open settings" }).first().click({ force: true });
  await page.waitForTimeout(700);
} else if (scenario === "search") {
  await reset("");
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(400);
  await page.keyboard.type("co");
  await page.waitForTimeout(500);
} else if (scenario === "drag") {
  await reset(`s.panels = { utilities: {x:200,y:200,w:360,h:400,open:true,locked:false} };`);
  const header = page.locator("[data-floating-root='panel-utilities'] [data-drag-handle]").first();
  const box = await header.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 300, box.y + box.height / 2 + 200, { steps: 14 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("mantle.v1")).panels.utilities);
  logs.push(`[check] panel saved after drag: ${JSON.stringify(saved)}`);
} else if (scenario === "context") {
  await reset(`s.panels = { utilities: {x:200,y:160,w:360,h:440,open:true,locked:false} };`);
  const tile = page.locator("[data-app-tile]").first();
  await tile.click({ button: "right" });
  await page.waitForTimeout(500);
}

await page.waitForTimeout(600);
const size = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
await page.screenshot({ path: out, type: "jpeg", quality: 60 });
console.log(JSON.stringify({ scenario, out, size, errors: logs.slice(0, 8) }, null, 1));
await browser.close();
