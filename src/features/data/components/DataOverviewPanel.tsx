import { Suspense, lazy, type Ref } from "react";
import DataHeatmapPanel from "./DataHeatmapPanel.tsx";
import DataTrendPanel from "./DataTrendPanel.tsx";
import type { HeatmapGranularity } from "./DataHeatmapPanel.tsx";
import type { HeatmapSelection, HeatmapWeek } from "../services/dataHeatmapReadModel.ts";
import type { DataTrendRangeSelection } from "../services/dataTrendRange.ts";

// Loaded on demand: the layout geometry is pure table data worth a few KiB and
// most sessions never open this panel, so it must not weigh on the data page
// for everyone.
const KeyboardHeatmapSection = lazy(() => import("./KeyboardHeatmapSection.tsx"));

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
  /** Clock the page resolved its trend range with; children must not read their own. */
  nowMs: number;
}

function DataOverviewPanel({
  trend,
  heatmap,
  keyboardActivityEnabled,
  nowMs,
}: DataOverviewPanelProps) {
  return (
    <div className="qp-panel p-5 data-overview">
      {/* The prop groups are spread rather than re-listed: the group keys already
          match the panel prop names, and listing them again made this wrapper as
          expensive as the children it forwards. */}
      <DataTrendPanel {...trend} />
      <DataHeatmapPanel {...heatmap} />
      {keyboardActivityEnabled ? (
        <Suspense fallback={null}>
          <KeyboardHeatmapSection nowMs={nowMs} selection={trend.selection} />
        </Suspense>
      ) : null}
    </div>
  );
}

export default DataOverviewPanel;
