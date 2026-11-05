import { spawn } from "node:child_process";

/** Snapshot of running process image names (lowercase, no extension). */
export function runningProcesses(): Promise<Set<string>> {
  return new Promise((resolve) => {
    const child = spawn("tasklist.exe", ["/fo", "csv", "/nh"], { windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
    let out = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      if (out.length < 4 * 1024 * 1024) out += chunk;
    });
    child.on("error", () => resolve(new Set()));
    child.on("close", () => {
      const set = new Set<string>();
      for (const line of out.split(/\r?\n/)) {
        const m = /^"([^"]+)"/.exec(line);
        if (!m) continue;
        set.add(m[1].toLowerCase().replace(/\.exe$/, ""));
        set.add(m[1].toLowerCase());
      }
      resolve(set);
    });
  });
}
