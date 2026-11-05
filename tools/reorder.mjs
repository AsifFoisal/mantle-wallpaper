/** Drag-to-organise checks for a collection panel. */
import { chromium } from "playwright";
const URL = process.env.MANTLE_URL ?? "http://127.0.0.1:7337/";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const errs = [];
p.on("pageerror", (e) => errs.push(e.message.slice(0, 160)));
await p.goto(URL, { waitUntil: "domcontentloaded" });
await p.evaluate(() => {
  localStorage.setItem(
    "mantle.v1",
    JSON.stringify({
      onboardingDismissed: true,
      panels: { development: { x: 150, y: 100, w: 420, h: 620, open: true, minimized: false, locked: false } },
    }),
  );
});
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(1600);
const S = () => p.evaluate(() => JSON.parse(localStorage.getItem("mantle.v1") ?? "{}"));
const panel = p.locator("[data-floating-root='panel-development']");
const order = () => panel.locator("[data-app-tile]").evaluateAll((ts) => ts.map((t) => t.dataset.appTile));
const names = () => panel.locator("[data-app-tile]").evaluateAll((ts) => ts.map((t) => t.textContent.trim()));

/** HTML5 drag via a synthetic DataTransfer (real mouse drags can't carry files in Playwright). */
async function dragTile(fromIdx, toIdx, position) {
  const ids = await order();
  const namesArr = await names();
  const from = panel.locator("[data-app-tile]").nth(fromIdx);
  const to = panel.locator("[data-app-tile]").nth(toIdx);
  const dt = await p.evaluateHandle(() => new DataTransfer());
  await from.dispatchEvent("dragstart", { dataTransfer: dt });
  const box = await to.boundingBox();
  await to.dispatchEvent("dragover", {
    dataTransfer: dt,
    clientX: position === "after" ? box.x + box.width - 3 : box.x + 2,
    clientY: box.y + box.height / 2,
  });
  const hint = await to.getAttribute("data-drop");
  await to.dispatchEvent("drop", {
    dataTransfer: dt,
    clientX: position === "after" ? box.x + box.width - 3 : box.x + 2,
    clientY: box.y + box.height / 2,
  });
  await p.waitForTimeout(400);
  return { moving: ids[fromIdx], target: ids[toIdx], hint };
}

const results = [];
const ok = (n, pass, d = "") => results.push(`${pass ? "PASS" : "FAIL"}  ${n}${pass ? "" : `  --  ${d}`}`);

// 1. move the 4th app to the very first slot
const before = await names();
const r1 = await dragTile(3, 0, "before");
const after = await names();
ok("drop indicator shows on hover", r1.hint === "before", r1.hint);
ok("dragged app moved to first position", after[0] === before[3], `${before[0]}.. → ${after[0]}`);
ok("other apps shift down", after.slice(1, 4).join("|") === before.slice(0, 3).join("|"));

// 2. order persists in storage
const st = await S();
ok("order persisted", typeof st.appOverrides[r1.moving]?.order?.development === "number");

// 3. reload keeps the arrangement
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(1500);
const afterReload = await names();
ok("arrangement survives reload", afterReload.slice(0, 4).join("|") === after.slice(0, 4).join("|"));

// 4. multi-select drag moves the whole selection
const tiles = panel.locator("[data-app-tile]");
await tiles.nth(1).click({ modifiers: ["Shift"] });
await tiles.nth(2).click({ modifiers: ["Shift"] });
await p.waitForTimeout(200);
const selNames = [(await names())[1], (await names())[2]];
const selIds = (await order()).slice(1, 3);
const sel = await dragTile(1, 6, "after");
const final = await names();
const group = selNames.map((n) => final.indexOf(n));
ok(
  "selected group moved together",
  group.length === 2 && group[1] === group[0] + 1 && group[0] > 3 && selIds.length === 2,
  `${selNames.join(",")} → idx ${group.join(",")}`,
);
ok("multi-drag clears selection", (await panel.getByRole("button", { name: /favorite/ }).count()) === 0);

// 5. moving to last position
const lastBefore = await names();
const r5 = await dragTile(0, lastBefore.length - 1, "after");
const lastAfter = await names();
ok("drop after last tile appends", lastAfter[lastAfter.length - 1] === lastBefore[0], `${lastBefore[0]} → ${lastAfter[lastAfter.length - 1]}`);
void r5;

console.log(results.join("\n"));
console.log(`\n${results.filter((r) => r.startsWith("PASS")).length}/${results.length} passed`);
if (errs.length) console.log("errors:", errs.slice(0, 5));
await b.close();
process.exit(results.every((r) => r.startsWith("PASS")) ? 0 : 1);
