import { useCallback, useEffect, useState } from "react";
import { readKeyboardActivitySnapshot } from "../services/keyboardHeatmapSnapshot.ts";
import {
  buildKeyboardHeatmapViewModel,
  type KeyboardHeatmapViewModel,
} from "../services/keyboardHeatmapReadModel.ts";
import {
  buildKeyboardHeatmapQueryKey,
  type KeyboardHeatmapRange,
} from "../services/keyboardHeatmapRange.ts";

interface KeyboardReadState {
  queryKey: string;
  snapshot: KeyboardHeatmapViewModel | null;
  status: "loading" | "ready" | "disabled" | "error";
}

export function useKeyboardHeatmapSnapshot(
  range: KeyboardHeatmapRange | null,
  enabled: boolean,
  layout: Parameters<typeof buildKeyboardHeatmapViewModel>[1],
) {
  const [retryKey, setRetryKey] = useState(0);
  const retry = useCallback(() => setRetryKey((value) => value + 1), []);
  // The key comes only from the resolved range, so it is stable for as long as
  // the caller's range is. See `buildKeyboardHeatmapQueryKey` for why a
  // wall-clock term must not appear here.
  const queryKey = buildKeyboardHeatmapQueryKey(range, layout, retryKey, enabled);
  // Primitive bounds rather than the range object: callers may pass a fresh
  // literal on every render, which would restart the effect each time even
  // though the window itself had not moved.
  const rangeStartMs = range?.startMs ?? null;
  const rangeEndMs = range?.endMs ?? null;
  const [state, setState] = useState<KeyboardReadState>(() => ({
    queryKey: "off",
    snapshot: null,
    status: enabled ? "loading" : "disabled",
  }));

  useEffect(() => {
    if (rangeStartMs === null || rangeEndMs === null || !enabled) {
      setState({ queryKey: "off", snapshot: null, status: "disabled" });
      return;
    }
    let cancelled = false;
    setState((current) => ({
      queryKey,
      snapshot: current.queryKey === queryKey ? current.snapshot : null,
      status: "loading",
    }));
    const load = async () => {
      try {
        const snapshot = await readKeyboardActivitySnapshot(rangeStartMs, rangeEndMs);
        if (cancelled) return;
        setState({
          queryKey,
          snapshot: buildKeyboardHeatmapViewModel(snapshot, layout),
          status: "ready",
        });
      } catch (error) {
        if (cancelled) return;
        console.warn("Failed to read keyboard activity:", error);
        setState({ queryKey, snapshot: null, status: "error" });
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [enabled, layout, queryKey, rangeEndMs, rangeStartMs]);

  const matchesQuery = state.queryKey === queryKey;
  return {
    viewModel: matchesQuery ? state.snapshot : null,
    loading: state.status === "loading" || !matchesQuery,
    disabled: state.status === "disabled",
    error: state.status === "error",
    retry,
  };
}
