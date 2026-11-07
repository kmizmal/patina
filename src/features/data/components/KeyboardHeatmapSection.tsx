import { useMemo, useState } from "react";
import { useLocaleText } from "../../../shared/i18n/index.ts";
import { useKeyboardHeatmapSnapshot } from "../hooks/useKeyboardHeatmapSnapshot.ts";
import type { KeyboardLayoutId } from "../services/keyboardLayout.ts";
import type { DataTrendRangeSelection } from "../services/dataTrendRange.ts";
import { resolveKeyboardHeatmapQuery } from "../services/keyboardHeatmapRange.ts";
import KeyboardHeatmapPanel from "./KeyboardHeatmapPanel.tsx";

/**
 * Container that owns the keyboard range, layout choice and read lifecycle.
 *
 * It lives outside `Data.tsx` on purpose: that file is a budgeted hotspot with
 * a few dozen lines of headroom, and this panel's state has nothing to do with
 * the rest of the data page.
 */
interface KeyboardHeatmapSectionProps {
  selection: DataTrendRangeSelection;
  /** Clock owned by the data page; it moves only when that page refreshes. */
  nowMs: number;
}

const DEFAULT_KEYBOARD_LAYOUT: KeyboardLayoutId = "Full";

export default function KeyboardHeatmapSection({
  nowMs,
  selection,
}: KeyboardHeatmapSectionProps) {
  const UI_TEXT = useLocaleText();
  const [layout, setLayout] = useState<KeyboardLayoutId>(DEFAULT_KEYBOARD_LAYOUT);
  // The range must be memoized against a clock the page owns. Resolving it from
  // `Date.now()` during render rebuilt `endMs` (it is clamped to "now") on every
  // render, so the read hook saw a new range each time, refetched, stored the
  // result, re-rendered, and looped until React threw "Maximum update depth
  // exceeded" — the panel never left its loading state.
  const { range } = useMemo(
    () => resolveKeyboardHeatmapQuery(selection, nowMs, UI_TEXT),
    [nowMs, selection, UI_TEXT],
  );
  const { viewModel, loading, disabled, error, retry } = useKeyboardHeatmapSnapshot(
    range,
    true,
    layout,
  );

  return (
    <KeyboardHeatmapPanel
      viewModel={viewModel}
      layout={layout}
      onLayoutChange={setLayout}
      loading={loading}
      disabled={disabled}
      error={error}
      onRetry={retry}
    />
  );
}
