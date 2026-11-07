import { useState } from "react";
import { useLocaleText } from "../../../shared/i18n/index.ts";
import { useKeyboardHeatmapSnapshot } from "../hooks/useKeyboardHeatmapSnapshot.ts";
import type { KeyboardLayoutId } from "../services/keyboardLayout.ts";
import { resolveDataTrendRange } from "../services/dataTrendRange.ts";
import type { DataTrendRangeSelection } from "../services/dataTrendRange.ts";
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
}

const DEFAULT_KEYBOARD_LAYOUT: KeyboardLayoutId = "Full";

export default function KeyboardHeatmapSection({
  selection,
}: KeyboardHeatmapSectionProps) {
  const UI_TEXT = useLocaleText();
  const [layout, setLayout] = useState<KeyboardLayoutId>(DEFAULT_KEYBOARD_LAYOUT);
  const range = resolveDataTrendRange(selection, Date.now(), UI_TEXT);
  const { viewModel, loading, disabled, error, retry } = useKeyboardHeatmapSnapshot(
    { startMs: range.startMs, endMs: range.endMs },
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
