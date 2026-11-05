/** Clicks every control type and reports which did nothing. */
import { chromium } from "playwright";
const URL = process.env.MANTLE_URL ?? "http://127.0.0.1:7337/";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const errs = [];
p.on("pageerror", (e) => errs.push(e.message.slice(0, 160)));
p.on("console", (m) => m.type() === "error" && !/401|Failed to load/.test(m.text()) && errs.push(m.text().slice(0, 160)));
const S = () => p.evaluate(() => JSON.parse(localStorage.getItem("mantle.v1") ?? "{}"));
const out = [];
const ok = (n, v, d = "") => out.push(`${v ? "PASS" : "FAIL"}  ${n}${v ? "" : "  --  " + d}`);

async function seed(extra = "") {
  await p.goto(URL, { waitUntil: "domcontentloaded" });
  await p.evaluate((src) => {
    localStorage.setItem("mantle.v1", JSON.stringify({ onboardingDismissed: true }));
    const s = JSON.parse(localStorage.getItem("mantle.v1"));
    new Function("s", src)(s);
    localStorage.setItem("mantle.v1", JSON.stringify(s));
  }, extra);
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1500);
}

await seed(`s.panels = { utilities: {x:150,y:150,w:380,h:480,open:true,minimized:false,locked:false} };`);
const panel = p.locator("[data-floating-root='panel-utilities']");
ok("panel open", await panel.isVisible());

// minimize
await panel.getByRole("button", { name: "Minimize" }).click();
await p.waitForTimeout(400);
ok("minimize collapses body", (await panel.boundingBox()).height < 90, `h=${(await panel.boundingBox()).height}`);
ok("minimize persisted", (await S()).panels.utilities.minimized === true);
// restore
await panel.getByRole("button", { name: "Restore" }).click();
await p.waitForTimeout(400);
ok("restore reopens body", (await panel.locator("[data-app-tile]").count()) > 0);

// hover peek on a collapsed panel
// Clicking Minimize leaves the pointer on the button, so the panel is already
// peeking. Park the pointer, let it collapse, then hover the title bar.
await panel.getByRole("button", { name: "Minimize" }).click();
await p.mouse.move(8, 860, { steps: 4 });
await new Promise((res) => setTimeout(res, 1100));
const slotH = () => p.evaluate(() => document.querySelector("[data-floating-slot='panel-utilities']").getBoundingClientRect().height);
const hMin = await slotH();
ok("collapsed to a title bar", hMin < 90, `h=${hMin}`);
const hb = await p.evaluate(() => {
  const r = document.querySelector("[data-floating-root='panel-utilities']").getBoundingClientRect();
  return { x: r.x, y: r.y };
});
await p.mouse.move(hb.x + 40, hb.y + 16, { steps: 10 });
await new Promise((res) => setTimeout(res, 900));
const hPeek = await slotH();
ok("hover opens collapsed panel", hPeek > hMin + 4, `min=${hMin} peek=${hPeek}`);
await p.mouse.move(8, 860, { steps: 8 });
await new Promise((res) => setTimeout(res, 1100));
ok("leave re-collapses panel", (await slotH()) <= hMin + 4);
ok("hover does not persist minimize flag", (await S()).panels.utilities.minimized === true);

// multi-select bulk actions
await panel.getByRole("button", { name: "Restore" }).click().catch(() => undefined);
await p.waitForTimeout(400);
const tiles = panel.locator("[data-app-tile]");
const picked = [];
for (let i = 0; i < 3; i++) {
  picked.push(await tiles.nth(i).getAttribute("data-app-tile"));
  await tiles.nth(i).click({ modifiers: ["Shift"] });
}
await p.waitForTimeout(300);
ok("multi-select shows action bar", await panel.getByRole("button", { name: /favorite/ }).isVisible());
await panel.getByRole("button", { name: /dock/ }).click();
await p.waitForTimeout(400);
const docked = (await S()).dock.appIds;
ok("bulk add to dock", picked.every((id) => docked.includes(id)), `${docked.length} in dock`);
for (let i = 0; i < 3; i++) await tiles.nth(i).click({ modifiers: ["Shift"] });
await p.waitForTimeout(200);
await panel.getByRole("button", { name: /favorite/ }).click();
await p.waitForTimeout(400);
const ov = (await S()).appOverrides;
ok("bulk favorite", picked.every((id) => ov[id]?.isFavorite === true));
for (let i = 0; i < 3; i++) await tiles.nth(i).click({ modifiers: ["Shift"] });
await p.waitForTimeout(200);
await panel.getByRole("button", { name: /remove/ }).click();
await p.waitForTimeout(400);
const ov2 = (await S()).appOverrides;
ok("bulk remove from collection", picked.every((id) => !(ov2[id]?.categories ?? []).includes("utilities")));
ok("selection clears after action", (await panel.getByRole("button", { name: /favorite/ }).count()) === 0);

// close
await panel.getByRole("button", { name: "Close" }).click();
await p.waitForTimeout(500);
ok("close hides panel", (await p.locator("[data-floating-root='panel-utilities']").getAttribute("data-panel-open")) === "false");
ok("close persisted", (await S()).panels.utilities.open === false);

// reopen from dock rail
// A brand-new collection is guaranteed empty, so the Add button is present.
await seed(`s.categories = [{id:"mine",name:"Mine",icon:"star",color:"#d9c7a3",order:0}];
  s.panels = { mine: {x:150,y:150,w:380,h:420,open:false,minimized:false,locked:false} };`);
await p.getByTitle("Mine").first().click();
await p.waitForTimeout(600);
ok("dock rail opens panel", (await S()).panels.mine.open === true);

// empty-state Add button opens search
const addBtn = p.getByRole("button", { name: /Add applications/ });
if (await addBtn.count()) {
  await addBtn.first().click();
  await p.waitForTimeout(400);
  ok("Add applications opens search", await p.getByPlaceholder(/Add apps to/).isVisible());
  await p.keyboard.press("Escape");
} else ok("Add applications opens search", false);

// settings
await p.getByRole("button", { name: /Open settings/ }).first().click({ force: true });
await p.waitForTimeout(600);
const settings = p.locator("[data-floating-root='settings']");
ok("settings opens", await settings.isVisible());
const secs = await settings.locator("nav button").allInnerTexts();
for (const s of secs) {
  await settings.locator("nav button", { hasText: new RegExp(`^${s}$`) }).click();
  await p.waitForTimeout(250);
  const visible = await settings.locator("section, .space-y-3, .flex.gap-2").count();
  ok(`settings tab "${s}" renders`, visible > 0);
}
// close via ×
await settings.locator("button[aria-label='Close settings']").click();
await p.waitForTimeout(400);
ok("settings close button", (await p.locator("[data-floating-root='settings']").count()) === 0);

// settings switches
await p.getByRole("button", { name: /Open settings/ }).first().click({ force: true });
await p.waitForTimeout(500);
const before = (await S()).settings.showClock;
await settings.getByRole("switch", { name: "Show clock" }).click();
await p.waitForTimeout(500);
ok("toggle writes state", (await S()).settings.showClock !== before);

// category add
await settings.locator("nav button", { hasText: "Categories" }).click();
await p.waitForTimeout(300);
await settings.locator("input[placeholder='New collection name']").fill("Test Cat");
await settings.getByRole("button", { name: "Add", exact: true }).click();
await p.waitForTimeout(500);
ok("add category", (await S()).categories.some((c) => c.name === "Test Cat"));

// context menu -> favourite
await p.keyboard.press("Escape");
await seed(`s.panels = { utilities: {x:150,y:150,w:380,h:480,open:true,minimized:false,locked:false} };`);
// Closed panels stay mounted but hidden, so scope tile lookups to the open one.
const tile = p.locator("[data-panel-open='true'] [data-app-tile]").first();
const id = await tile.getAttribute("data-app-tile");
await tile.click({ button: "right" });
await p.waitForTimeout(600);
const favItem = p.getByRole("menuitem", { name: /Add to favorites/ });
// Menu items live in a fixed overlay that can extend past the viewport edge.
await favItem.click({ force: true });
await p.waitForTimeout(500);
ok("context menu favorite", (await S()).appOverrides?.[id]?.isFavorite === true);

// dock actions
await seed("");
await p.getByTitle("Favorites").click();
await p.waitForTimeout(600);
ok("favorites overlay opens", await p.getByText("Pinned", { exact: true }).isVisible());
await p.keyboard.press("Escape");
await p.waitForTimeout(300);

console.log(out.join("\n"));
console.log(`\n${out.filter((l) => l.startsWith("PASS")).length}/${out.length} passed`);
if (errs.length) console.log("errors:", errs.slice(0, 6));
await b.close();
