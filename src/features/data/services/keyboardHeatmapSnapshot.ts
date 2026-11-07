import {
  loadKeyboardActivitySnapshot,
  type KeyboardActivitySnapshot,
} from "../../../platform/persistence/keyboardActivityGateway.ts";

/**
 * Bridge between the keyboard gateway and the data feature.
 *
 * The hook that drives the panel is UI-layer code and may not reach into
 * `src/platform`, so the gateway call is funnelled through here, the same way
 * `dataHeatmapSnapshot.ts` wraps the session repository.
 */
export async function readKeyboardActivitySnapshot(
  startMs: number,
  endMs: number,
): Promise<KeyboardActivitySnapshot> {
  return loadKeyboardActivitySnapshot(startMs, endMs);
}
