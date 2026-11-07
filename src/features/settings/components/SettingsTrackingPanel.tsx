import { useLocaleText } from "../../../shared/i18n/index.ts";
import { MousePointerClick, RefreshCw, Trash2 } from "lucide-react";
import QuietSwitch from "../../../shared/components/QuietSwitch";
import QuietActionRow from "../../../shared/components/QuietActionRow";
import QuietButton from "../../../shared/components/QuietButton";

import QuietStepperSlider from "../../../shared/components/QuietStepperSlider.tsx";
import SettingsPanelHeader from "./SettingsPanelHeader";
import { SettingsPreferenceGroup, SettingsPreferenceRow } from "./SettingsPreferenceLayout";

type MinuteControlProps = {
  label: string;
  hint: string;
  minutes: number;
  minMinutes: number;
  maxMinutes: number;
  onMinutesChange: (nextMinutes: number) => void;
};

type SettingsTrackingPanelProps = {
  idleTimeoutControl: MinuteControlProps;
  timelineMergeGapControl: MinuteControlProps;
  trackingPaused: boolean;
  onTrackingPausedChange: (nextChecked: boolean) => void;
  titleRecordingEnabled: boolean;
  onTitleRecordingEnabledChange: (nextChecked: boolean) => void;
  keyboardActivityEnabled: boolean;
  onKeyboardActivityEnabledChange: (nextChecked: boolean) => void;
  isClearingKeyboard: boolean;
  onClearKeyboardActivity: () => void;
};

type MinuteStepperSliderProps = {
  ariaLabel: string;
  minutes: number;
  minMinutes: number;
  maxMinutes: number;
  onMinutesChange: (nextMinutes: number) => void;
};

function MinuteStepperSlider({
  ariaLabel,
  minutes,
  minMinutes,
  maxMinutes,
  onMinutesChange,
}: MinuteStepperSliderProps) {
  const UI_TEXT = useLocaleText();
  return (
    <QuietStepperSlider
      className="settings-minute-control"
      ariaLabel={ariaLabel}
      value={minutes}
      min={minMinutes}
      max={maxMinutes}
      displayValue={UI_TEXT.settings.minuteValue(minutes)}
      decreaseAriaLabel={UI_TEXT.settings.decreaseMinute(ariaLabel)}
      increaseAriaLabel={UI_TEXT.settings.increaseMinute(ariaLabel)}
      onChange={onMinutesChange}
    />
  );
}

function TrackingMinuteField({
  label,
  hint,
  minutes,
  minMinutes,
  maxMinutes,
  onMinutesChange,
}: MinuteControlProps) {
  return (
    <SettingsPreferenceRow title={label} hint={hint} stacked>
      <div className="settings-preference-slider">
        <MinuteStepperSlider
          ariaLabel={label}
          minutes={minutes}
          minMinutes={minMinutes}
          maxMinutes={maxMinutes}
          onMinutesChange={onMinutesChange}
        />
      </div>
    </SettingsPreferenceRow>
  );
}

export default function SettingsTrackingPanel({
  idleTimeoutControl,
  timelineMergeGapControl,
  trackingPaused,
  onTrackingPausedChange,
  titleRecordingEnabled,
  onTitleRecordingEnabledChange,
  keyboardActivityEnabled,
  onKeyboardActivityEnabledChange,
  isClearingKeyboard,
  onClearKeyboardActivity,
}: SettingsTrackingPanelProps) {
  const UI_TEXT = useLocaleText();
  return (
    <section className="qp-panel p-5 md:p-6">
      <SettingsPanelHeader
        icon={<MousePointerClick size={16} className="text-[var(--qp-accent-default)]" />}
        title={UI_TEXT.settings.trackingPanelTitle}
      />

      <div className="mt-5 space-y-5">
        <SettingsPreferenceGroup title={UI_TEXT.settings.timeRulesTitle}>
          <QuietActionRow className="settings-preference-list">
            <TrackingMinuteField {...timelineMergeGapControl} />
            <TrackingMinuteField {...idleTimeoutControl} />
          </QuietActionRow>
        </SettingsPreferenceGroup>
        <SettingsPreferenceGroup title={UI_TEXT.settings.recordingOptionsTitle}>
          <QuietActionRow className="settings-preference-list settings-preference-pair">
            <SettingsPreferenceRow title={UI_TEXT.settings.trackingPausedLabel}>
              <QuietSwitch
                checked={trackingPaused}
                onChange={onTrackingPausedChange}
                ariaLabel={UI_TEXT.accessibility.settings.toggleTrackingPaused}
              />
            </SettingsPreferenceRow>
            <SettingsPreferenceRow title={UI_TEXT.settings.globalTitleLabel} hint={UI_TEXT.settings.globalTitleHint}>
              <QuietSwitch
                checked={titleRecordingEnabled}
                onChange={onTitleRecordingEnabledChange}
                ariaLabel={UI_TEXT.accessibility.settings.toggleGlobalTitle}
              />
            </SettingsPreferenceRow>
          </QuietActionRow>
          <QuietActionRow className="settings-preference-list">
            <SettingsPreferenceRow
              title={UI_TEXT.settings.keyboardLabel}
              hint={UI_TEXT.settings.keyboardHint}
            >
              <QuietSwitch
                checked={keyboardActivityEnabled}
                onChange={onKeyboardActivityEnabledChange}
                ariaLabel={UI_TEXT.accessibility.settings.toggleKeyboardActivity}
              />
            </SettingsPreferenceRow>
            {/* Deleting sits next to the switch it belongs to, but it stays
                available after the switch is off: turning recording off was
                never a promise that the old totals were gone. */}
            <SettingsPreferenceRow
              title={UI_TEXT.settings.keyboardDataClear}
              hint={UI_TEXT.settings.keyboardDataClearHint}
            >
              <QuietButton
                tone="danger"
                size="regular"
                busy={isClearingKeyboard}
                onClick={onClearKeyboardActivity}
              >
                {isClearingKeyboard
                  ? <RefreshCw size={14} className="animate-spin" />
                  : <Trash2 size={14} />}
                {UI_TEXT.settings.keyboardDataClear}
              </QuietButton>
            </SettingsPreferenceRow>
          </QuietActionRow>
        </SettingsPreferenceGroup>
      </div>
    </section>
  );
}
