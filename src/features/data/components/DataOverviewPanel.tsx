import type { Ref } from "react";
import DataHeatmapPanel from "./DataHeatmapPanel.tsx";
import DataTrendPanel from "./DataTrendPanel.tsx";
import KeyboardHeatmapSection from "./KeyboardHeatmapSection.tsx";
import type { HeatmapGranularity } from "./DataHeatmapPanel.tsx";
import type { HeatmapSelection, HeatmapWeek } from "../services/dataHeatmapReadModel.ts";
import type { DataTrendRangeSelection } from "../services/dataTrendRange.ts";

/**
 * The overview cluster of the data page: trend chart, day heatmap, and the
 * keyboard heatmap when capture is on.
 *
 * These three share one panel and one range selection, so they are owned here
 * rather than in `Data.tsx`: that page is a budgeted hotspot and staying under
 * its budget means each cluster owns its own props.
 */
interface DataOverviewPanelProps {
  trend: {
    allTimeStartDateKey: string;
    allTimeEndDateKey: string;
    selection: DataTrendRangeSelection;
    onSelectionChange: (selection: DataTrendRangeSelection) => void;
    readState: Parameters<typeof DataTrendPanel>[0]["readState"];
    chartRef: Ref<HTMLDivElement>;
    initialDimension: Parameters<typeof DataTrendPanel>[0]["initialDimension"];
    canOpenHistory: boolean;
    onMouseDownCapture: Parameters<typeof DataTrendPanel>[0]["onMouseDownCapture"];
    onDoubleClickCapture: Parameters<typeof DataTrendPanel>[0]["onDoubleClickCapture"];
    onMouseMove: Parameters<typeof DataTrendPanel>[0]["onMouseMove"];
    onMouseLeave: Parameters<typeof DataTrendPanel>[0]["onMouseLeave"];
  };
  heatmap: {
    selectedHeatmapView: HeatmapSelection;
    selectedHeatmapViewKey: string;
    rows: HeatmapWeek[];
    granularity: HeatmapGranularity;
    granularityOptions: Array<{ value: HeatmapGranularity; label: string }>;
    canSelectOlderHeatmapView: boolean;
    canSelectNewerHeatmapView: boolean;
    onGranularityChange: (granularity: HeatmapGranularity) => void;
    onSelectAdjacentHeatmapView: (delta: number) => void;
    onOpenHistoryDate?: (dateKey: string) => void;
    loading: boolean;
    errorMessage: string | null;
    refreshFailed: boolean;
    onRetry: () => void;
  };
  keyboardActivityEnabled: boolean;
}

export default function DataOverviewPanel({
  trend,
  heatmap,
  keyboardActivityEnabled,
}: DataOverviewPanelProps) {
  return (
    <div className="qp-panel p-5 data-overview">
      <DataTrendPanel
        allTimeEndDateKey={trend.allTimeEndDateKey}
        allTimeStartDateKey={trend.allTimeStartDateKey}
        selection={trend.selection}
        readState={trend.readState}
        chartRef={trend.chartRef}
        initialDimension={trend.initialDimension}
        canOpenHistory={trend.canOpenHistory}
        onSelectionChange={trend.onSelectionChange}
        onMouseDownCapture={trend.onMouseDownCapture}
        onDoubleClickCapture={trend.onDoubleClickCapture}
        onMouseMove={trend.onMouseMove}
        onMouseLeave={trend.onMouseLeave}
      />

      <DataHeatmapPanel
        selectedHeatmapView={heatmap.selectedHeatmapView}
        selectedHeatmapViewKey={heatmap.selectedHeatmapViewKey}
        rows={heatmap.rows}
        granularity={heatmap.granularity}
        granularityOptions={heatmap.granularityOptions}
        canSelectOlderHeatmapView={heatmap.canSelectOlderHeatmapView}
        canSelectNewerHeatmapView={heatmap.canSelectNewerHeatmapView}
        onGranularityChange={heatmap.onGranularityChange}
        onSelectAdjacentHeatmapView={heatmap.onSelectAdjacentHeatmapView}
        onOpenHistoryDate={heatmap.onOpenHistoryDate}
        loading={heatmap.loading}
        errorMessage={heatmap.errorMessage}
        refreshFailed={heatmap.refreshFailed}
        onRetry={heatmap.onRetry}
      />

      {keyboardActivityEnabled
        ? <KeyboardHeatmapSection selection={trend.selection} />
        : null}
    </div>
  );
}
