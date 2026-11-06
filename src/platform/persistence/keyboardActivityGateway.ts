import { invokeWithCommandError } from "./commandError.ts";

const KEYBOARD_SNAPSHOT_COMMAND = "cmd_get_keyboard_activity_snapshot";
const KEYBOARD_CLEAR_COMMAND = "cmd_clear_keyboard_activity";

export interface KeyboardKeyTotal {
  keyName: string;
  keyCode: number;
  pressCount: number;
}

export interface KeyboardComboTotal {
  comboKey: string;
  pressCount: number;
}

export interface KeyboardActivitySnapshot {
  rangeStartMs: number;
  rangeEndMs: number;
  totalPresses: number;
  keys: KeyboardKeyTotal[];
  combos: KeyboardComboTotal[];
}

/**
 * Reads aggregated keyboard activity for a closed range.
 *
 * The range is computed by the caller from the active range selector so this
 * gateway never reinterprets "today" or timezone boundaries.
 */
export async function loadKeyboardActivitySnapshot(
  rangeStartMs: number,
  rangeEndMs: number,
): Promise<KeyboardActivitySnapshot> {
  return invokeWithCommandError<KeyboardActivitySnapshot>(KEYBOARD_SNAPSHOT_COMMAND, {
    rangeStartMs,
    rangeEndMs,
  });
}

/** Deletes every recorded keyboard bucket; other tracked data is untouched. */
export async function clearKeyboardActivity(): Promise<number> {
  return invokeWithCommandError<number>(KEYBOARD_CLEAR_COMMAND);
}
