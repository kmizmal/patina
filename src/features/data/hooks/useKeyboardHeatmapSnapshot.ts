import { useCallback, useEffect, useState } from "react";
import { readKeyboardActivitySnapshot } from "../services/keyboardHeatmapSnapshot.ts";
import {
  buildKeyboardHeatmapViewModel,
  type KeyboardHeatmapViewModel,
} from "../services/keyboardHeatmapReadModel.ts";

interface KeyboardReadState {
  queryKey: string;
  snapshot: KeyboardHeatmapViewModel | null;
  status: "loading" | "ready" | "disabled" | "error";
}

/**
 * Keyboard buckets are written at most once a minute, so a read pinned to the
 * current minute would refetch constantly for one extra press. The query key
 * therefore rounds to the hour: the panel refreshes when the hour turns, when
 * the user changes the range, or when they retry by hand.
 */
const HOUR_MS = 60 * 60 * 1000;

function hourKey(nowMs: number): number {
  return Math.floor(nowMs / HOUR_MS);
}

export interface KeyboardHeatmapRange {
  startMs: number;
  endMs: number;
}

export function useKeyboardHeatmapSnapshot(
  range: KeyboardHeatmapRange | null,
  enabled: boolean,
  layout: Parameters<typeof buildKeyboardHeatmapViewModel>[1],
) {
  const [retryKey, setRetryKey] = useState(0);
  const retry = useCallback(() => setRetryKey((value) => value + 1), []);
  const queryKey =
    range === null || !enabled
      ? "off"
      : `${hourKey(Date.now())}:${range.startMs}:${range.endMs}:${layout}:${retryKey}`;
  const [state, setState] = useState<KeyboardReadState>(() => ({
    queryKey: "off",
    snapshot: null,
    status: enabled ? "loading" : "disabled",
  }));

  useEffect(() => {
    if (range === null || !enabled) {
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
        const snapshot = await readKeyboardActivitySnapshot(range.startMs, range.endMs);
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
  }, [enabled, layout, queryKey, range?.endMs, range?.startMs]);

  const matchesQuery = state.queryKey === queryKey;
  return {
    viewModel: matchesQuery ? state.snapshot : null,
    loading: state.status === "loading" || !matchesQuery,
    disabled: state.status === "disabled",
    error: state.status === "error",
    retry,
  };
}
