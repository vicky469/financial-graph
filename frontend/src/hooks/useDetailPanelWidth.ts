import { useState, useEffect, useCallback } from "react";

const DETAIL_PANEL_DEFAULT_WIDTH = 400;
const DETAIL_PANEL_MIN_WIDTH = 400;
const DETAIL_PANEL_MAX_WIDTH = 900;
const DETAIL_PANEL_RESERVED_SPACE = 560;
const DETAIL_PANEL_WIDTH_STORAGE_KEY = "detail_panel_width_v1";

export const getDetailPanelMaxWidth = (viewportWidth: number): number => {
  const constrainedMax = Math.min(DETAIL_PANEL_MAX_WIDTH, viewportWidth - DETAIL_PANEL_RESERVED_SPACE);
  return Math.max(DETAIL_PANEL_MIN_WIDTH, constrainedMax);
};

const getInitialDetailPanelWidth = (): number => {
  if (typeof window === "undefined") {
    return DETAIL_PANEL_DEFAULT_WIDTH;
  }

  try {
    const raw = window.localStorage.getItem(DETAIL_PANEL_WIDTH_STORAGE_KEY);
    const parsed = raw ? Number(raw) : DETAIL_PANEL_DEFAULT_WIDTH;
    const width = Number.isFinite(parsed) ? parsed : DETAIL_PANEL_DEFAULT_WIDTH;
    const maxWidth = getDetailPanelMaxWidth(window.innerWidth);
    return Math.min(Math.max(width, DETAIL_PANEL_MIN_WIDTH), maxWidth);
  } catch {
    return DETAIL_PANEL_DEFAULT_WIDTH;
  }
};

const persistDetailPanelWidth = (width: number) => {
  try {
    window.localStorage.setItem(DETAIL_PANEL_WIDTH_STORAGE_KEY, String(width));
  } catch {
    // Ignore persistence failures (e.g. private mode / quota).
  }
};

export function useDetailPanelWidth() {
  const [detailPanelWidth, setDetailPanelWidth] = useState(getInitialDetailPanelWidth);

  const updateDetailPanelWidth = useCallback((width: number) => {
    setDetailPanelWidth(width);
    persistDetailPanelWidth(width);
  }, []);

  // Handle window resize to constrain panel width
  useEffect(() => {
    const handleResize = () => {
      const maxWidth = getDetailPanelMaxWidth(window.innerWidth);
      setDetailPanelWidth((current) => Math.min(current, maxWidth));
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return {
    detailPanelWidth,
    setDetailPanelWidth: updateDetailPanelWidth,
    minWidth: DETAIL_PANEL_MIN_WIDTH,
    maxWidth: DETAIL_PANEL_MAX_WIDTH,
  };
}
