import { useEffect } from "react";

const TEXT_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export function isTextTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  return TEXT_TAGS.has(el.tagName);
}

const CODE_ALIASES: Record<string, string> = {
  arrowup: "arrowup",
  arrowdown: "arrowdown",
  arrowleft: "arrowleft",
  arrowright: "arrowright",
  escape: "escape",
  enter: "enter",
  space: " ",
  tab: "tab",
  backspace: "backspace",
  delete: "delete",
};

/** Binds a combo like "ctrl+k", "escape", "arrowdown". Ignores text inputs unless allowInInput. */
export function useKey(
  combo: string,
  handler: (e: KeyboardEvent) => void,
  opts: { enabled?: boolean; allowInInput?: boolean } = {},
) {
  const { enabled = true, allowInInput = false } = opts;

  useEffect(() => {
    if (!enabled) return;
    const parts = combo.toLowerCase().split("+");
    const key = parts[parts.length - 1];
    const needCtrl = parts.includes("ctrl") || parts.includes("mod");
    const needShift = parts.includes("shift");
    const needAlt = parts.includes("alt");
    const alias = CODE_ALIASES[key];

    const onKey = (e: KeyboardEvent) => {
      if (!allowInInput && isTextTarget(e.target) && key !== "escape") return;
      const pressed = e.key.toLowerCase();
      const match = alias
        ? pressed === alias
        : key.length === 1
          ? pressed === key
          : pressed === key || e.code.toLowerCase().replace(/^key/, "") === key;
      if (!match) return;
      if (needCtrl !== (e.ctrlKey || e.metaKey)) return;
      if (needShift !== e.shiftKey) return;
      if (needAlt !== e.altKey) return;
      handler(e);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [combo, handler, enabled, allowInInput]);
}
