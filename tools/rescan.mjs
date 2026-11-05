/** Verifies rescanning never disturbs user organization. */
import { chromium } from "playwright";
const URL = process.env.MANTLE_URL ?? "http://127.0.0.1:7337/";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 850 } });
await p.goto(URL, { waitUntil: "networkidle" });
await p.waitForTimeout(1500);
const ids = await p.evaluate(async () => {
  const t = window.__MANTLE_TOKEN__ ?? (await (await fetch("/api/bootstrap")).json()).token;
  const r = await fetch("/api/apps", { headers: { "X-Mantle-Token": t } });
  const apps = (await r.json()).apps;
  // Take two apps, force a custom organization.
  const [a, b] = apps;
  const s = JSON.parse(localStorage.getItem("mantle.v1") ?? "{}");
  s.appOverrides = {
    [a.id]: { categories: ["games"], categoriesManual: true, isFavorite: true, displayName: "My Renamed App" },
    [b.id]: { categories: ["media"], categoriesManual: true },
  };
  s.dock = { ...(s.dock ?? {}), appIds: [a.id, b.id] };
  s.categories = (s.categories ?? []).filter((c) => c.id !== "utilities");
  s.categories.push({ id: "mine", name: "My Collection", icon: "star", color: "#f0b48a", order: 9 });
  localStorage.setItem("mantle.v1", JSON.stringify(s));
  return { a: a.id, b: b.id, token: t };
});
const r = await fetch(`${URL.replace(/\/$/, "")}/api/apps/scan`, { method: "POST", headers: { "X-Mantle-Token": ids.token } });
console.log("scan start", r.status);
let done = false;
for (let i = 0; i < 60 && !done; i++) {
  await new Promise((res) => setTimeout(res, 1000));
  const st = await (await fetch(`${URL.replace(/\/$/, "")}/api/system/status`, { headers: { "X-Mantle-Token": ids.token } })).json();
  done = !st.scanning;
}
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(2500);
const after = await p.evaluate(() => JSON.parse(localStorage.getItem("mantle.v1")));
const a = after.appOverrides[Object.keys(after.appOverrides)[0]];
console.log(JSON.stringify({
  scanDone: done,
  overrideKept: a.displayName === "My Renamed App" && a.isFavorite === true && a.categories.includes("games"),
  dockKept: after.dock.appIds.length === 2,
  customCategoryKept: after.categories.some((c) => c.id === "mine"),
  deletedCategoryStayedDeleted: !after.categories.some((c) => c.id === "utilities"),
}, null, 1));
await b.close();
