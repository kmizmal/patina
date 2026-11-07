import { memo, useCallback, type CSSProperties } from "react";
import { useLocale, useLocaleText } from "../../../shared/i18n/index.ts";
import QuietSegmentedFilter from "../../../shared/components/QuietSegmentedFilter";
import {
  KEYBOARD_LAYOUTS,
  KEYBOARD_LAYOUT_IDS,
  KEY_STEP,
  type KeyboardLayoutId,
} from "../services/keyboardLayout.ts";
import type {
  KeyboardHeatmapViewModel,
} from "../services/keyboardHeatmapReadModel.ts";

/**
 * Rendered height of one 1u key in pixels.
 *
 * The layout data is unit-based so it stays resolution independent; the panel
 * fixes the scale here rather than in CSS so the key rectangles and the
 * container size can never disagree.
 */
const KEY_RENDER_UNIT = 30;

const numberFormatterCache = new Map<string, Intl.NumberFormat>();
function formatCount(value: number, locale: string): string {
  let formatter = numberFormatterCache.get(locale);
  if (formatter === undefined) {
    formatter = new Intl.NumberFormat(locale);
    numberFormatterCache.set(locale, formatter);
  }
  return formatter.format(value);
}

const percentFormatterCache = new Map<string, Intl.NumberFormat>();
function formatShare(value: number, locale: string): string {
  let formatter = percentFormatterCache.get(locale);
  if (formatter === undefined) {
    formatter = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });
    percentFormatterCache.set(locale, formatter);
  }
  return formatter.format(value);
}

interface KeyboardHeatmapPanelProps {
  viewModel: KeyboardHeatmapViewModel | null;
  layout: KeyboardLayoutId;
  onLayoutChange: (layout: KeyboardLayoutId) => void;
  loading?: boolean;
  disabled?: boolean;
  error: boolean;
  onRetry: () => void;
}

const LEGEND_STOPS = [0.16, 0.4, 0.62, 0.85, 1];

function KeyboardHeatmapPanel({
  viewModel,
  layout,
  onLayoutChange,
  loading = false,
  disabled = false,
  error,
  onRetry,
}: KeyboardHeatmapPanelProps) {
  const UI_TEXT = useLocaleText();
  const locale = useLocale();
  const layoutDefinition = KEYBOARD_LAYOUTS[layout];
  const scale = KEY_RENDER_UNIT / KEY_STEP;

  const layoutOptions = KEYBOARD_LAYOUT_IDS.map((id) => ({
    value: id,
    label: UI_TEXT.data.keyboardLayouts[id],
  }));

  const handleLayoutChange = useCallback(
    (next: KeyboardLayoutId) => {
      if (next !== layout) onLayoutChange(next);
    },
    [layout, onLayoutChange],
  );

  return (
    <section className="qp-panel p-5 data-keyboard-heatmap">
      <header className="data-keyboard-heatmap-header">
        <h3 className="qp-panel-title">{UI_TEXT.data.keyboardHeatmap}</h3>
        <QuietSegmentedFilter
          value={layout}
          options={layoutOptions}
          onChange={handleLayoutChange}
          ariaLabel={UI_TEXT.accessibility.data.keyboardLayoutFilter}
        />
      </header>

      {disabled ? (
        <p className="data-keyboard-heatmap-empty">{UI_TEXT.data.keyboardDisabled}</p>
      ) : error ? (
        <div className="data-keyboard-heatmap-empty">
          <span>{UI_TEXT.data.keyboardError}</span>
          <button type="button" className="qp-link-button" onClick={onRetry}>
            {UI_TEXT.data.keyboardRetry}
          </button>
        </div>
      ) : viewModel === null || viewModel.totalPresses <= 0 ? (
        <p className="data-keyboard-heatmap-empty">
          {loading ? UI_TEXT.data.keyboardLoading : UI_TEXT.data.keyboardEmpty}
        </p>
      ) : (
        <>
          <div className="data-keyboard-heatmap-layout">
            <div
              className="data-keyboard-heatmap-keys"
              style={{
                width: layoutDefinition.width * scale,
                height: layoutDefinition.height * scale,
              }}
            >
              {viewModel.keys.map((key) => (
                <div
                  key={key.key}
                  className="data-keyboard-key"
                  data-active={key.pressCount > 0}
                  title={
                    key.pressCount > 0
                      ? UI_TEXT.data.keyboardKeyTooltip(
                          key.label,
                          formatCount(key.pressCount, locale),
                          formatShare(key.share, locale),
                        )
                      : key.label
                  }
                  style={
                    {
                      left: key.x * scale,
                      top: key.y * scale,
                      width: key.width * scale,
                      height: key.height * scale,
                      "--keyboard-intensity": key.intensity,
                    } as CSSProperties
                  }
                >
                  <span aria-hidden="true">{key.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="data-keyboard-heatmap-legend" aria-hidden="true">
            <span className="data-keyboard-heatmap-legend-swatch" data-legend="empty" />
            {LEGEND_STOPS.map((stop) => (
              <span
                key={stop}
                className="data-keyboard-heatmap-legend-swatch"
                style={{ "--keyboard-intensity": stop } as CSSProperties}
              />
            ))}
          </div>

          {viewModel.layoutMismatch ? (
            <p className="data-keyboard-heatmap-empty">{UI_TEXT.data.keyboardLayoutMismatch}</p>
          ) : null}

          <div className="data-keyboard-heatmap-columns">
            <div>
              <h4 className="data-keyboard-heatmap-subheading">
                {UI_TEXT.data.keyboardTopKeys}
              </h4>
              <ul className="data-keyboard-heatmap-list">
                {viewModel.rankedKeys.slice(0, 10).map((key) => (
                  <li key={key.key} className="data-keyboard-heatmap-list-row">
                    <span>{key.label}</span>
                    <span className="data-keyboard-heatmap-list-bar">
                      <span
                        className="data-keyboard-heatmap-list-bar-fill"
                        style={{
                          width: `${Math.max(2, (key.pressCount / viewModel.maxKeyPressCount) * 100)}%`,
                        }}
                      />
                    </span>
                    <span className="data-keyboard-heatmap-list-value">
                      {formatCount(key.pressCount, locale)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="data-keyboard-heatmap-subheading">
                {UI_TEXT.data.keyboardTopCombos}
              </h4>
              {viewModel.combos.length === 0 ? (
                <p className="data-keyboard-heatmap-empty">{UI_TEXT.data.keyboardNoCombos}</p>
              ) : (
                <ul className="data-keyboard-heatmap-list">
                  {viewModel.combos.slice(0, 10).map((combo) => (
                    <li key={combo.comboKey} className="data-keyboard-heatmap-list-row">
                      <span>{combo.comboKey}</span>
                      <span className="data-keyboard-heatmap-list-bar">
                        <span
                          className="data-keyboard-heatmap-list-bar-fill"
                          style={{
                            width: `${Math.max(
                              2,
                              (combo.pressCount / viewModel.combos[0].pressCount) * 100,
                            )}%`,
                          }}
                        />
                      </span>
                      <span className="data-keyboard-heatmap-list-value">
                        {formatCount(combo.pressCount, locale)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export default memo(KeyboardHeatmapPanel);
