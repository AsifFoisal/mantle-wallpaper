import { useEffect, useState } from "react";

export interface ContextMenuState {
  id: string;
  x: number;
  y: number;
}

/** App-level context menu so it can escape panel overflow clipping. */
export function useContextMenu() {
  const [menu, setMenu] = useState<ContextMenuState | null>(null);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("pointerdown", close, true);
    window.addEventListener("keydown", close);
    window.addEventListener("blur", close);
    window.addEventListener("wheel", close, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", close, true);
      window.removeEventListener("keydown", close);
      window.removeEventListener("blur", close);
      window.removeEventListener("wheel", close);
    };
  }, [menu]);

  return {
    menu,
    open: (id: string, e: React.MouseEvent | { clientX: number; clientY: number }) => {
      const ev = e as React.MouseEvent;
      ev.preventDefault?.();
      ev.stopPropagation?.();
      const px = Math.min(e.clientX + 2, window.innerWidth - 232);
      const py = Math.min(e.clientY + 2, window.innerHeight - 320);
      setMenu({ id, x: Math.max(8, px), y: Math.max(8, py) });
    },
    close: () => setMenu(null),
  };
}
