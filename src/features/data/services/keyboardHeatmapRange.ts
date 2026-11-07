import {
  resolveDataTrendRange,
  type DataTrendRangeSelection,
  type ResolvedDataTrendRange,
} from "./dataTrendRange.ts";
import type { UiText } from "../../../shared/i18n/index.ts";
import type { KeyboardLayoutId } from "./keyboardLayout.ts";

/** Closed millisecond window the keyboard snapshot is read for. */
export interface KeyboardHeatmapRange {
  startMs: number;
  endMs: number;
}

export interface KeyboardHeatmapQuery {
  range: KeyboardHeatmapRange;
  resolved: ResolvedDataTrendRange;
}

/**
 * Resolves the keyboard window from the data page's range selector.
 *
 * `nowMs` is an argument on purpose: the caller must pass a clock it owns (see
 * `useDataTrendSnapshot`), because resolving "now" inside a render rebuilds
 * `endMs` — it is clamped to the current instant — and anything keyed on that
 * window would refetch on every render instead of once per range.
 */
export function resolveKeyboardHeatmapQuery(
  selection: DataTrendRangeSelection,
  nowMs: number,
  uiText: UiText,
): KeyboardHeatmapQuery {
  const resolved = resolveDataTrendRange(selection, nowMs, uiText);
  return { range: { startMs: resolved.startMs, endMs: resolved.endMs }, resolved };
}

/**
 * Identity of one keyboard read.
 *
 * Deliberately free of any clock term: the window already encodes the moment it
 * was resolved, so adding "the hour it is now" would only restart the read on
 * every render while the window stayed the same.
 */
export function buildKeyboardHeatmapQueryKey(
  range: KeyboardHeatmapRange | null,
  layout: KeyboardLayoutId,
  retryKey: number,
  enabled = true,
): string {
  if (range === null || !enabled) return "off";
  return `${range.startMs}:${range.endMs}:${layout}:${retryKey}`;
}
