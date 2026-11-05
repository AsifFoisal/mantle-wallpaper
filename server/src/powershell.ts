import { spawn } from "node:child_process";

export interface PsResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

/** Runs a .ps1 file, passing JSON through stdin. Never builds shell strings. */
export function runPs(scriptPath: string, payload: unknown, timeoutMs = 120_000): Promise<PsResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptPath],
      { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
    );
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`PowerShell timed out: ${scriptPath}`));
    }, timeoutMs);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      if (stdout.length < 64 * 1024 * 1024) stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });
    child.stdin.end(JSON.stringify(payload ?? {}));
  });
}

export function parseJson<T>(stdout: string): T {
  const text = stdout.trim().replace(/^﻿/, "");
  if (!text) throw new Error("Empty output");
  const start = Math.min(...[text.indexOf("["), text.indexOf("{")].filter((i) => i >= 0));
  if (!Number.isFinite(start)) throw new Error(`No JSON in output: ${text.slice(0, 160)}`);
  return JSON.parse(text.slice(start)) as T;
}
