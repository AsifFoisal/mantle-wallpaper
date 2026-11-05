import { createContext, useContext, useMemo } from "react";

export const APP_MIME = "application/x-mantle-app";

export interface DragBridge {
  /** Starts a native HTML5 drag for an app; resolves the canonical appId on drop, else null. */
  startAppDrag: (appId: string, e: React.DragEvent) => void;
}

export const DragBridgeContext = createContext<DragBridge | null>(null);
export const useDragBridge = () => useContext(DragBridgeContext);

export function useAppLookup() {
  const fromEvent = (e: React.DragEvent | React.PointerEvent): string | null => {
    if ("dataTransfer" in e) {
      const id = e.dataTransfer?.getData(APP_MIME);
      return id || null;
    }
    return null;
  };
  return useMemo(() => ({ fromEvent }), []);
}

export function isAppDrag(e: React.DragEvent) {
  return e.dataTransfer?.types?.includes(APP_MIME) ?? false;
}
