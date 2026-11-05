/** Streams the companion's request log, flagging anything that isn't the test harness. */
const base = process.env.MANTLE_BASE ?? "http://127.0.0.1:7337";
const fs = await import("node:fs");
const token = fs.readFileSync(process.env.LOCALAPPDATA + "/Mantle Wallpaper/token", "utf8").trim();
const seen = new Set();
const end = Date.now() + Number(process.argv[2] ?? 120) * 1000;
while (Date.now() < end) {
  const r = await fetch(`${base}/api/system/requests`, { headers: { "X-Mantle-Token": token } });
  const { requests } = await r.json();
  for (const q of requests.reverse()) {
    const key = q.t + q.path;
    if (seen.has(key)) continue;
    seen.add(key);
    const tag =
      /HeadlessChrome/i.test(q.ua) ? " [headless-test]"
      : (q.origin ?? "").includes(":5173") ? " [vite-dev]"
      : /PowerShell|curl/i.test(q.ua) ? " [cli]"
      : " [wallpaper]";
    console.log(`${q.t.slice(11, 19)} ${q.status} ${q.method} ${q.origin ?? "-"} ${q.path.split("?")[0]}${tag}`);
  }
  await new Promise((r) => setTimeout(r, 1000));
}
