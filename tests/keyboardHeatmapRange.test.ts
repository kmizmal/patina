import assert from "node:assert/strict";
import {
  buildKeyboardHeatmapQueryKey,
  resolveKeyboardHeatmapQuery,
  type KeyboardHeatmapRange,
} from "../src/features/data/services/keyboardHeatmapRange.ts";
import type { DataTrendRangeSelection } from "../src/features/data/services/dataTrendRange.ts";
import { getLocaleText } from "../src/shared/i18n/runtime.ts";

const ZH_TEXT = getLocaleText("zh-CN");
const NOW_MS = new Date(2026, 4, 20, 12, 0, 0).getTime();
const SELECTION: DataTrendRangeSelection = { kind: "rolling", days: 7 };

let passed = 0;

function runTest(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

runTest("range is the resolved trend window and stays put for one clock", () => {
  const first = resolveKeyboardHeatmapQuery(SELECTION, NOW_MS, ZH_TEXT);
  const second = resolveKeyboardHeatmapQuery(SELECTION, NOW_MS, ZH_TEXT);

  assert.equal(first.range.startMs, first.resolved.startMs);
  assert.equal(first.range.endMs, first.resolved.endMs);
  assert.deepEqual(first.range, second.range);
});

runTest("the window end is clamped to now, so an advancing clock moves it", () => {
  const morning = resolveKeyboardHeatmapQuery(SELECTION, NOW_MS, ZH_TEXT);
  const afternoon = resolveKeyboardHeatmapQuery(SELECTION, NOW_MS + 3 * 60 * 60 * 1000, ZH_TEXT);

  assert.equal(morning.range.startMs, afternoon.range.startMs);
  assert.ok(afternoon.range.endMs > morning.range.endMs);
});

runTest("query key ignores the clock and tracks only the read inputs", () => {
  const range = resolveKeyboardHeatmapQuery(SELECTION, NOW_MS, ZH_TEXT).range;

  assert.equal(
    buildKeyboardHeatmapQueryKey(range, "Full", 0),
    buildKeyboardHeatmapQueryKey(range, "Full", 0),
  );
  assert.notEqual(
    buildKeyboardHeatmapQueryKey(range, "Full", 0),
    buildKeyboardHeatmapQueryKey(range, "TKL", 0),
  );
  assert.notEqual(
    buildKeyboardHeatmapQueryKey(range, "Full", 0),
    buildKeyboardHeatmapQueryKey(range, "Full", 1),
  );
});

runTest("query key separates windows that differ only at their end", () => {
  const base: KeyboardHeatmapRange = { startMs: NOW_MS - 1000, endMs: NOW_MS };
  const next: KeyboardHeatmapRange = { startMs: NOW_MS - 1000, endMs: NOW_MS + 1 };

  assert.notEqual(
    buildKeyboardHeatmapQueryKey(base, "Full", 0),
    buildKeyboardHeatmapQueryKey(next, "Full", 0),
  );
});

runTest("query key reports an off state with no readable window", () => {
  const range = resolveKeyboardHeatmapQuery(SELECTION, NOW_MS, ZH_TEXT).range;

  assert.equal(buildKeyboardHeatmapQueryKey(null, "Full", 0), "off");
  assert.equal(buildKeyboardHeatmapQueryKey(range, "Full", 0, false), "off");
});

console.log(`${passed} keyboard heatmap range tests passed`);
