import { useStore } from "../state/store";
import { mantleApi } from "../api/mantle";
import type { AppView } from "../lib/apps";

export async function launchApp(view: AppView | undefined, appId: string) {
  const store = useStore.getState();
  store.markRecent(appId);
  if (!view) return;
  if (store.backend !== "online") {
    store.toast({ title: "Desktop bridge offline", detail: "Start the Mantle companion service to launch apps.", tone: "warn" });
    return;
  }
  if (!view.app.targetExists) {
    store.toast({ title: `${view.name} can't be found`, detail: "The shortcut target is missing. Try rescanning.", tone: "warn" });
    return;
  }
  try {
    await mantleApi.launch(appId);
  } catch (err) {
    store.toast({
      title: `Couldn't launch ${view.name}`,
      detail: err instanceof Error ? err.message : "Unknown error",
      tone: "warn",
    });
  }
}

export function isRunning(view: AppView, running: Set<string>): boolean {
  const exe = view.app.executableName?.toLowerCase();
  if (!exe) return false;
  return running.has(exe.replace(/\.exe$/, "")) || running.has(exe);
}
