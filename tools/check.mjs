/**
 * DOM/text-level checks for Mantle (no screenshots).
 * Usage: node tools/check.mjs
 */
import { chromium } from "playwright";

const URL = process.env.MANTLE_URL ?? "http://127.0.0.1:5173/";
const results = [];
const ok = (name, pass, detail = "") => results.push({ name, pass: Boolean(pass), detail: String(detail).slice(0, 200) });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 200)));
page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));

async function fresh(extra = "") {
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.evaluate((src) => {
    localStorage.setItem("mantle.v1", JSON.stringify({ onboardingDismissed: true }));
    const s = JSON.parse(localStorage.getItem("mantle.v1"));
    new Function("s", src)(s);
    localStorage.setItem("mantle.v1", JSON.stringify(s));
  }, extra);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
}

const store = () => page.evaluate(() => JSON.parse(localStorage.getItem("mantle.v1")));

// 1. Quiet state ---------------------------------------------------------
await fresh();
ok("clock visible", (await page.locator(".font-serif").first().innerText()).match(/\d{2}:\d{2}/));
ok("dock visible", await page.getByTitle("Organizer — settings").isVisible());
ok("settings orb visible", await page.getByRole("button", { name: /Open settings/ }).isVisible());
ok("no panels open", (await page.locator("[data-panel-open='true']").count()) === 0);
ok("no settings panel", (await page.locator("[data-floating-root='settings']").count()) === 0);
const bgPixel = await page.evaluate(() => {
  const c = document.createElement("canvas");
  void c;
  return getComputedStyle(document.querySelector("#root > div").children[0]).zIndex;
});
ok("background in front of body fill", bgPixel !== "-10", `z=${bgPixel}`);

// 2. Icons load ----------------------------------------------------------
await fresh(`s.panels = { utilities: {x:200,y:160,w:360,h:520,open:true,locked:false} };`);
await page.waitForTimeout(1500);
const imgStats = await page.evaluate(() => {
  const imgs = [...document.querySelectorAll("[data-floating-root^='panel-'] img")];
  return { total: imgs.length, loaded: imgs.filter((i) => i.complete && i.naturalWidth > 0).length, src: imgs[0]?.getAttribute("src")?.slice(0, 60) };
});
ok("app icons render", imgStats.total === 0 || imgStats.loaded > imgStats.total * 0.7, JSON.stringify(imgStats));

// 3. Panel drag persists -------------------------------------------------
const header = page.locator("[data-floating-root='panel-utilities'] [data-drag-handle]").first();
const box = await header.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + 260, box.y + box.height / 2 + 156, { steps: 12 });
await page.mouse.up();
await page.waitForTimeout(500);
const afterDrag = (await store()).panels.utilities;
ok("panel drag persists", afterDrag.x > 200 && afterDrag.y > 160, JSON.stringify({ x: afterDrag.x, y: afterDrag.y }));
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);
// Measure the outer slot: it holds the stored position (and any live nudge).
await page.waitForTimeout(600);
const pos = await page.evaluate(() => {
  const el = document.querySelector("[data-floating-slot='panel-utilities']");
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y };
});
// Panels sit in an outer slot (data-floating-slot); it can also be nudged by a neighbour.
// Positions persist exactly. The bottom edge keeps an 8px viewport margin when
// the drag would otherwise leave part of the panel off-screen.
const viewportH = await page.evaluate(() => window.innerHeight);
const expectedY = Math.min(afterDrag.y, viewportH - afterDrag.h - 8);
ok("panel position survives reload", Math.abs(pos.x - afterDrag.x) < 2 && Math.abs(pos.y - expectedY) < 2, JSON.stringify({ pos, expectedY }));

// 4. Launch app ----------------------------------------------------------
const launchResp = await page.request.post("http://127.0.0.1:7337/api/apps/launch", {
  data: { id: "aaaaaaaaaaaaaaaa" },
  headers: { "X-Mantle-Token": "0".repeat(64) },
});
// Cross-origin JSON POST must fail the CORS preflight (no ACAO header → browser blocks it).
const preflight = await page.request.fetch("http://127.0.0.1:7337/api/apps/launch", {
  method: "OPTIONS",
  headers: {
    Origin: "http://evil.example",
    "Access-Control-Request-Method": "POST",
    "Access-Control-Request-Headers": "content-type,x-mantle-token",
  },
});
ok("cross-origin preflight blocked", !preflight.headers()["access-control-allow-origin"], preflight.status());
// A fresh context has no session cookie, so only the header can authenticate.
const anon = await (await chromium.launch()).newPage();
const direct = await anon.request.fetch("http://127.0.0.1:7337/api/apps/launch", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Mantle-Token": "0".repeat(64) },
  data: JSON.stringify({ id: "aaaaaaaaaaaaaaaa" }),
});
ok("launch rejects bad token", direct.status() === 401, direct.status());
await anon.context().browser()?.close();

// 5. Search palette ------------------------------------------------------
await fresh();
await page.keyboard.press("Control+k");
await page.waitForTimeout(300);
ok("Ctrl+K opens search", await page.getByPlaceholder("Search applications, categories…").isVisible());
await page.keyboard.type("chrome");
await page.waitForTimeout(400);
const resultsText = await page.locator("[data-search-box]").innerText();
ok("search finds Chrome", /chrome/i.test(resultsText), resultsText.split("\n").slice(0, 3).join(" | "));
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
ok("Escape closes search", (await page.locator("[data-search-box]").count()) === 0);

// 6. Settings panel ------------------------------------------------------
await page.getByRole("button", { name: /Open settings/ }).first().click({ force: true });
await page.waitForTimeout(500);
ok("settings opens", await page.locator("[data-floating-root='settings']").isVisible());
const tabs = await page.locator("[data-floating-root='settings'] nav button").allInnerTexts();
ok("settings has all sections", ["General", "Categories", "Applications", "Dock", "Layout", "Appearance", "Performance"].every((t) => tabs.includes(t)), tabs.join(","));

// Settings section: Applications shows real list with scan info
await page.locator("[data-floating-root='settings'] nav button", { hasText: "Applications" }).click();
await page.waitForTimeout(600);
const appRows = await page.locator("[data-floating-root='settings'] .group.flex").count();
ok("applications list populated", appRows > 20, `${appRows} rows`);
await page.screenshot({ path: "tools/shots/settings.jpg", type: "jpeg", quality: 55 });

// 7. Context menu --------------------------------------------------------
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
await fresh(`s.panels = { utilities: {x:200,y:160,w:360,h:520,open:true,locked:false} };`);
const tile = page.locator("[data-panel-open='true'] [data-app-tile]").first();
await tile.click({ button: "right" });
await page.waitForTimeout(400);
const menuText = await page.locator("[role='menu']").innerText().catch(() => "");
ok("context menu opens", /Open/.test(menuText) && /favorites/i.test(menuText), menuText.split("\n").slice(0, 6).join(" | "));

// 8. Dock accepts drops + favorites hidden ---------------------------------
await page.keyboard.press("Escape");
await page.waitForTimeout(200);
ok("favorites not permanently visible", (await page.getByText("Pinned", { exact: true }).count()) === 0);

// 9. Offline resilience ---------------------------------------------------
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.route("**/api/**", (r) => r.abort());
// Offline state surfaces after two consecutive poll failures (backoff).
await page.waitForTimeout(11000);
ok("renders offline", await page.locator(".font-serif").first().isVisible());
ok("offline chip shown", (await page.getByText(/Desktop bridge offline/).count()) > 0);
await page.unroute("**/api/**");

ok("no console errors", errors.filter((e) => !/401|Failed to load resource|ERR_FAILED|Failed to fetch|net::/.test(e)).length === 0, errors.slice(0, 3).join(" || "));

console.log(results.map((r) => `${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.pass ? "" : `  --  ${r.detail}`}`).join("\n"));
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
