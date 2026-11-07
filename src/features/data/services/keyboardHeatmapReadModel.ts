import {
  KEYBOARD_LAYOUTS,
  KEYBOARD_REGIONS,
  keyboardRegionFor,
  type KeyboardKey,
  type KeyboardLayoutId,
  type KeyboardRegionId,
} from "./keyboardLayout.ts";
import type { KeyboardActivitySnapshot } from "../../../platform/persistence/keyboardActivityGateway.ts";

/** How strong the weakest coloured key is; mirrors the day heatmap floor. */
const MIN_KEY_INTENSITY = 0.16;

export interface KeyboardHeatmapKey extends KeyboardKey {
  pressCount: number;
  intensity: number;
  /** Share of all presses in the range, 0-1. Unrounded; callers format it. */
  share: number;
}

export interface KeyboardHeatmapRegion {
  id: KeyboardRegionId;
  pressCount: number;
  share: number;
}

export interface KeyboardHeatmapCombo {
  comboKey: string;
  pressCount: number;
  share: number;
}

export interface KeyboardHeatmapViewModel {
  totalPresses: number;
  keys: KeyboardHeatmapKey[];
  /** Keys with at least one press, most pressed first. */
  rankedKeys: KeyboardHeatmapKey[];
  regions: KeyboardHeatmapRegion[];
  combos: KeyboardHeatmapCombo[];
  maxKeyPressCount: number;
  /** True when the range holds presses but none fall on the chosen layout. */
  layoutMismatch: boolean;
}

const EMPTY_VIEW_MODEL: KeyboardHeatmapViewModel = {
  totalPresses: 0,
  keys: [],
  rankedKeys: [],
  regions: [],
  combos: [],
  maxKeyPressCount: 0,
  layoutMismatch: false,
};

function buildRegions(
  rankedKeys: KeyboardHeatmapKey[],
  totalPresses: number,
): KeyboardHeatmapRegion[] {
  const counts = new Map<KeyboardRegionId, number>();
  for (const key of rankedKeys) {
    const region = keyboardRegionFor(key.key);
    if (region === null) continue;
    counts.set(region, (counts.get(region) ?? 0) + key.pressCount);
  }
  return KEYBOARD_REGIONS.filter((region) => counts.has(region.id))
    .map((region) => {
      const pressCount = counts.get(region.id) ?? 0;
      return {
        id: region.id,
        pressCount,
        share: totalPresses > 0 ? pressCount / totalPresses : 0,
      };
    })
    .sort((a, b) => b.pressCount - a.pressCount);
}

/**
 * Turns a stored snapshot into the heatmap view model.
 *
 * Intensity is relative to the busiest key in the same range rather than to an
 * absolute scale, because absolute keystroke counts swing by orders of
 * magnitude between a typing day and a reading day and an absolute ramp would
 * leave most ranges flat.
 */
export function buildKeyboardHeatmapViewModel(
  snapshot: KeyboardActivitySnapshot | null,
  layout: KeyboardLayoutId,
): KeyboardHeatmapViewModel {
  if (snapshot === null || snapshot.totalPresses <= 0) return EMPTY_VIEW_MODEL;

  const byKey = new Map<string, { pressCount: number; keyCode: number }>();
  for (const key of snapshot.keys) {
    byKey.set(key.keyName, { pressCount: key.pressCount, keyCode: key.keyCode });
  }
  let maxKeyPressCount = 0;
  for (const entry of byKey.values()) {
    if (entry.pressCount > maxKeyPressCount) maxKeyPressCount = entry.pressCount;
  }

  const keys: KeyboardHeatmapKey[] = KEYBOARD_LAYOUTS[layout].keys.map((definition) => {
    const entry = byKey.get(definition.key);
    const pressCount = entry?.pressCount ?? 0;
    const intensity =
      pressCount <= 0 || maxKeyPressCount <= 0
        ? 0
        : Math.max(MIN_KEY_INTENSITY, pressCount / maxKeyPressCount);
    return {
      ...definition,
      pressCount,
      intensity,
      share: snapshot.totalPresses > 0 ? pressCount / snapshot.totalPresses : 0,
    };
  });

  const rankedKeys = [...byKey.entries()]
    .map(([keyName, entry]) => {
      const definition = keys.find((candidate) => candidate.key === keyName);
      const intensity =
        maxKeyPressCount <= 0
          ? 0
          : Math.max(MIN_KEY_INTENSITY, entry.pressCount / maxKeyPressCount);
      return {
        key: keyName,
        label: definition?.label ?? keyName,
        x: definition?.x ?? 0,
        y: definition?.y ?? 0,
        width: definition?.width ?? 0,
        height: definition?.height ?? 0,
        pressCount: entry.pressCount,
        intensity,
        share: entry.pressCount / snapshot.totalPresses,
      };
    })
    .sort((a, b) => b.pressCount - a.pressCount || a.key.localeCompare(b.key));

  const combos: KeyboardHeatmapCombo[] = snapshot.combos
    .filter((combo) => combo.pressCount > 0)
    .map((combo) => ({
      comboKey: combo.comboKey,
      pressCount: combo.pressCount,
      share: snapshot.totalPresses > 0 ? combo.pressCount / snapshot.totalPresses : 0,
    }))
    .sort((a, b) => b.pressCount - a.pressCount || a.comboKey.localeCompare(b.comboKey));

  return {
    totalPresses: snapshot.totalPresses,
    keys,
    rankedKeys,
    regions: buildRegions(rankedKeys, snapshot.totalPresses),
    combos,
    maxKeyPressCount,
    layoutMismatch: rankedKeys.length > 0 && keys.every((key) => key.pressCount === 0),
  };
}
