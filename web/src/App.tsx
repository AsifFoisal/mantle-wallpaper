import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "./state/store";
import { initServerSync } from "./state/serverSync";
import { useBackendSync } from "./hooks/useBackendSync";
import { useAppIndex } from "./hooks/useAppIndex";
import { useKey } from "./hooks/useKey";
import { Background } from "./components/wallpaper/Background";
import { Clock } from "./components/wallpaper/Clock";
import { Dock } from "./components/dock/Dock";
import { SettingsButton } from "./components/floating/SettingsButton";
import { CategoryPanel } from "./components/panels/CategoryPanel";
import { FavoritesOverlay } from "./components/panels/FavoritesOverlay";
import { SearchPalette } from "./components/search/SearchPalette";
import { SettingsWindow, type SettingsSection } from "./components/settings/SettingsWindow";
import { Toasts } from "./components/ui/Toasts";
import { SnapGuides } from "./components/floating/SnapGuides";
import { OfflineChip } from "./components/ui/OfflineChip";
import { FirstRunHint } from "./components/ui/FirstRunHint";
import { ContextMenuLayer } from "./components/panels/AppContextMenu";
import { useContextMenu } from "./hooks/useContextMenu";
import { suggestCategories } from "./lib/categorize";
import { APP_MIME } from "./lib/dnd";

export default function App() {
  const hydrated = useStore((s) => s.hydrated);
  const hydrate = useStore((s) => s.hydrate);
  const settings = useStore((s) => s.persist.settings);
  const categories = useStore((s) => s.persist.categories);
  const panels = useStore((s) => s.persist.panels);
  const dock = useStore((s) => s.persist.dock);
  const onboardingDismissed = useStore((s) => s.persist.onboardingDismissed);
  const settingsOpen = useStore((s) => s.settingsOpen);
  const searchOpen = useStore((s) => s.searchOpen);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const setSearchOpen = useStore((s) => s.setSearchOpen);
  const openAssign = useStore((s) => s.openAssign);
  const { byId } = useAppIndex();
  const [section, setSection] = useState<SettingsSection>("general");
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const ctx = useContextMenu();
  const onScanComplete = useRef<(() => void) | null>(null);

  useEffect(() => {
    hydrate();
    // Mirror the organization to the companion so it survives Lively's browser
    // profile being wiped between sessions.
    initServerSync();
  }, [hydrate]);

  useBackendSync(onScanComplete);

  // Suggest collections for freshly detected apps. Manual assignments are never touched.
  const suggestNewApps = useCallback(() => {
    const state = useStore.getState();
    const pending = state.apps.filter((a) => {
      const o = state.persist.appOverrides[a.id];
      return !o?.categoriesManual && !o?.ignoredSuggestion && (o?.categories?.length ?? 0) === 0;
    });
    if (!pending.length) return;
    const suggestions = suggestCategories(pending, state.persist.categories);
    if (!suggestions.size) return;
    for (const [id, cat] of suggestions) {
      state.setOverride(id, { categories: [cat.id] });
    }
    state.toast({
      title: `Organized ${suggestions.size} new ${suggestions.size === 1 ? "application" : "applications"}`,
      detail: "Placed into suggested collections. Right-click any app to adjust.",
      tone: "success",
      actionLabel: "Review",
      action: () => {
        state.setSettingsOpen(true);
        window.dispatchEvent(new CustomEvent("mantle:settings-section", { detail: "applications" }));
      },
    });
  }, []);
  onScanComplete.current = suggestNewApps;

  const appsLen = useStore((s) => s.apps.length);
  const scanning = useStore((s) => s.scan.scanning);
  const reviewed = useRef(false);
  useEffect(() => {
    if (reviewed.current || appsLen === 0 || scanning) return;
    reviewed.current = true;
    const t = setTimeout(suggestNewApps, 1200);
    return () => clearTimeout(t);
  }, [appsLen, scanning, suggestNewApps]);

  useEffect(() => {
    const onSection = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail) setSection(detail as SettingsSection);
    };
    window.addEventListener("mantle:settings-section", onSection);
    return () => window.removeEventListener("mantle:settings-section", onSection);
  }, []);

  const openTo = useCallback(
    (next: string) => {
      setSection(next as SettingsSection);
      setSettingsOpen(true);
    },
    [setSettingsOpen],
  );

  useKey(
    "ctrl+k",
    (e) => {
      e.preventDefault();
      setSearchOpen(!useStore.getState().searchOpen);
    },
    { allowInInput: true },
  );

  useKey(
    "escape",
    () => {
      const state = useStore.getState();
      if (state.searchOpen) state.setSearchOpen(false);
      else if (state.settingsOpen) state.setSettingsOpen(false);
    },
    { allowInInput: true },
  );

  // Clicking bare wallpaper closes transient surfaces.
  const onWallpaperPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.target !== e.currentTarget) return;
    const state = useStore.getState();
    if (state.searchOpen) state.setSearchOpen(false);
    if (state.settingsOpen) state.setSettingsOpen(false);
    setFavoritesOpen(false);
  }, []);

  // Channel for tile drags that don't build their own dataTransfer.
  useEffect(() => {
    const onDragStart = (e: DragEvent) => {
      const tile = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-app-tile]");
      if (!tile?.dataset.appTile || !e.dataTransfer) return;
      if (!e.dataTransfer.types.includes(APP_MIME)) {
        e.dataTransfer.setData(APP_MIME, tile.dataset.appTile);
      }
      e.dataTransfer.effectAllowed = "copyMove";
    };
    document.addEventListener("dragstart", onDragStart);
    return () => document.removeEventListener("dragstart", onDragStart);
  }, []);

  const pendingHint = useStore((s) => s.apps.length > 0 && s.hydrated);
  if (!hydrated) return null;

  const sortedCategories = [...categories].sort((a, b) => a.order - b.order);
  const anyPanelOpen = sortedCategories.some((c) => panels[c.id]?.open);

  return (
    <div
      className={`relative isolate h-full w-full overflow-hidden bg-ink-950 ${settings.animationEnabled && !settings.lowResourceMode ? "" : "mantle-static"}`}
      onPointerDown={onWallpaperPointerDown}
    >
      <Background
        mode={settings.background.mode}
        imageDataUrl={settings.background.imageDataUrl}
        imageFit={settings.background.imageFit}
        gradientFrom={settings.background.gradientFrom}
        gradientTo={settings.background.gradientTo}
        gradientAngle={settings.background.gradientAngle}
        intensity={settings.background.ambientIntensity}
        animate={settings.animationEnabled && !settings.lowResourceMode}
      />

      <div className="relative z-10 flex h-full w-full flex-col justify-between">
        <div className="h-24" />
        <Clock />
      </div>

      {dock.visible && <Dock onOrganizer={() => openTo("general")} onFavorites={() => setFavoritesOpen(true)} />}

      <SettingsButton onOpenTo={openTo} />

      {/* Every panel stays mounted so a drag is never torn down mid-gesture
          (closed panels render hidden and inert). */}
      {sortedCategories.map((cat) => (
        <CategoryPanel key={cat.id} category={cat} geometry={panels[cat.id]} onAddApps={openAssign} />
      ))}

      {settingsOpen && <SettingsWindow section={section} onSection={setSection} />}

      {searchOpen && <SearchPalette onClose={() => setSearchOpen(false)} />}

      {favoritesOpen && <FavoritesOverlay onClose={() => setFavoritesOpen(false)} />}

      <ContextMenuLayer menu={ctx.menu} close={ctx.close} byId={byId} categories={categories} />

      <OfflineChip />
      <Toasts />
      <SnapGuides />

      <FirstRunHint
        visible={pendingHint && !anyPanelOpen && !onboardingDismissed}
        onOpen={() => {
          useStore.getState().openCategory(sortedCategories[0]?.id ?? "utilities");
          useStore.getState().toast({ title: "Collections open on demand", detail: "Right-click any app to move it. Ctrl K searches everything.", tone: "info" });
        }}
      />
    </div>
  );
}
