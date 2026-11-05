import type { AppView } from "../../lib/apps";
import type { ScanStatus } from "../../types";
import type { ContextMenuState } from "../../hooks/useContextMenu";

export type ContextMenuIds = ContextMenuState;

export interface AppActions {
  views: AppView[];
  viewById: (id: string) => AppView | undefined;
  scan: ScanStatus;
  settingsOpen: boolean;
  searchOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  openSettingsTo: (section: string) => void;
  launch: (view: AppView) => void;
  startDrag: (view: AppView, e: React.DragEvent) => void;
}
