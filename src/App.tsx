import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import { buildChartDataModel } from "./chart/model";
import { formatAmount, renderChart } from "./chart/renderers";
import { buildStatementModel } from "./domain/statement";
import { parseWorkbookArrayBuffer, parseWorkbookFile } from "./excel/workbookReader";
import { renderRevealReportHtml } from "./reveal/renderRevealReportHtml";
import type {
  ChartDataModel,
  ChartSpec,
  Diagnostic,
  DiagnosticReport,
  DiagnosticSeverity,
  ParsedWorkbook,
  PlViewMode,
  ReportConfig,
  StatementLine,
  StatementModel,
} from "./types";

const workflowSteps = ["Upload", "Validate", "Configure", "Preview", "Export"] as const;

const defaultConfig: ReportConfig = {
  title: "Board Report",
  companyName: "Demo Manufacturing GmbH",
  reportPeriodLabel: "FY 2025",
  language: "bilingual",
  amountScale: "thousand",
  plViewMode: "ytd",
  themeId: "boardroom-minimal",
  selectedSlideIds: [],
  generatedAt: new Date().toISOString(),
};

type PipelineState =
  | { status: "idle"; message: string }
  | { status: "loading"; message: string }
  | { status: "ready"; parsed: ParsedWorkbook; statement: StatementModel; chartData: ChartDataModel; message: string }
  | { status: "error"; message: string };

type DemoKind = "sample-valid" | "sample-with-warnings";

export function App() {
  const inputId = useId();
  const [pipeline, setPipeline] = useState<PipelineState>({
    status: "idle",
    message: "Load a demo workbook or upload an .xlsx file with TB and Mapping sheets.",
  });
  const [config, setConfig] = useState<ReportConfig>(() => readStoredConfig());
  const [exportMessage, setExportMessage] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && typeof window.localStorage?.setItem === "function") {
      window.localStorage.setItem("trial-balance-reporter:config", JSON.stringify(config));
    }
  }, [config]);

  const activeStep = pipeline.status === "ready" ? 4 : pipeline.status === "idle" ? 1 : 2;
  const diagnostics = pipeline.status === "ready" ? pipeline.parsed.diagnostics : null;

  async function loadDemo(kind: DemoKind): Promise<void> {
    setPipeline({ status: "loading", message: `Loading ${kind}.xlsx...` });
    setExportMessage("");

    try {
      const response = await fetch(`./examples/${kind}.xlsx`);

      if (!response.ok) {
        throw new Error(`Could not load ${kind}.xlsx. Run pnpm generate:fixtures first.`);
      }

      const buffer = await response.arrayBuffer();
      setReady(parseWorkbookArrayBuffer(buffer, `${kind}.xlsx`), `${kind}.xlsx loaded.`);
    } catch (error) {
      setPipeline({
        status: "error",
        message: error instanceof Error ? error.message : "Demo workbook could not be loaded.",
      });
    }
  }

  async function handleUpload(file: File | undefined): Promise<void> {
    if (!file) {
      return;
    }

    setPipeline({ status: "loading", message: `Reading ${file.name} locally...` });
    setExportMessage("");

    try {
      setReady(await parseWorkbookFile(file), `${file.name} parsed locally.`);
    } catch (error) {
      setPipeline({
        status: "error",
        message: error instanceof Error ? error.message : "Workbook could not be parsed.",
      });
    }
  }

  function setReady(parsed: ParsedWorkbook, message: string): void {
    const statement = buildStatementModel(parsed);
    const chartData = buildChartDataModel(statement, parsed.diagnostics);
    const entityName = parsed.tbRows.find((row) => row.metadata["#entity_name"])?.metadata["#entity_name"];

    if (entityName) {
      setConfig((current) => ({ ...current, companyName: entityName }));
    }

    setPipeline({ status: "ready", parsed, statement, chartData, message });
  }

  function exportReport(): void {
    if (pipeline.status !== "ready") {
      return;
    }

    const exportConfig = { ...config, generatedAt: new Date().toISOString() };
    const html = renderRevealReportHtml({
      statement: pipeline.statement,
      chartData: pipeline.chartData,
      diagnostics: pipeline.parsed.diagnostics,
      config: exportConfig,
    });
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const fileName = `${slugify(exportConfig.companyName)}-${slugify(exportConfig.reportPeriodLabel)}-report.html`;

    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
    setExportMessage(`${fileName} exported as a self-contained HTML report.`);
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-5 sm:px-8 lg:px-10">
        <header className="border-b border-slate-200 pb-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
              Browser-only financial reporting
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">
              trial-balance-reporter
            </h1>
          </div>
        </header>

        <section className="grid gap-6 py-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-5">
            <Workflow activeStep={activeStep} />
            <UploadPanel
              inputId={inputId}
              pipeline={pipeline}
              onDemoLoad={loadDemo}
              onUpload={(file) => {
                void handleUpload(file);
              }}
            />
            <ConfigPanel config={config} setConfig={setConfig} />
          </aside>

          <section className="space-y-6">
            <StatusBanner pipeline={pipeline} />
            {diagnostics ? <DiagnosticsPanel diagnostics={diagnostics} /> : <EmptyState />}

            {pipeline.status === "ready" ? (
              <>
                <StatementPreview statement={pipeline.statement} plViewMode={config.plViewMode} amountScale={config.amountScale} />
                <ChartPreview chartData={pipeline.chartData} amountScale={config.amountScale} plViewMode={config.plViewMode} />
                <ExportPanel
                  disabled={pipeline.parsed.diagnostics.summary.blocking > 0}
                  exportMessage={exportMessage}
                  onExport={exportReport}
                />
              </>
            ) : null}
          </section>
        </section>
      </div>
    </main>
  );
}

function Workflow({ activeStep }: { activeStep: number }) {
  return (
    <section className="panel">
      <h2 className="panel-title">MVP workflow</h2>
      <ol className="mt-4 space-y-3">
        {workflowSteps.map((step, index) => {
          const stepNumber = index + 1;
          const isActive = stepNumber <= activeStep;

          return (
            <li className="flex items-center gap-3" key={step}>
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                  isActive ? "bg-blue-700 text-white" : "bg-slate-200 text-slate-600"
                }`}
              >
                {stepNumber}
              </span>
              <span className="text-sm font-medium text-slate-700">{step}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function UploadPanel({
  inputId,
  pipeline,
  onDemoLoad,
  onUpload,
}: {
  inputId: string;
  pipeline: PipelineState;
  onDemoLoad: (kind: DemoKind) => Promise<void>;
  onUpload: (file: File | undefined) => void;
}) {
  const isLoading = pipeline.status === "loading";

  return (
    <section className="panel">
      <h2 className="panel-title">Upload</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        All Excel processing stays in your browser. Raw financial data is not written to LocalStorage.
      </p>
      <div className="mt-4 grid gap-2">
        <button className="primary-button" type="button" disabled={isLoading} onClick={() => void onDemoLoad("sample-valid")}>
          Load Demo
        </button>
        <button
          className="secondary-button w-full"
          type="button"
          disabled={isLoading}
          onClick={() => void onDemoLoad("sample-with-warnings")}
        >
          Load Warning Demo
        </button>
        <label className="secondary-button w-full cursor-pointer" htmlFor={inputId}>
          Upload Excel
        </label>
        <input
          id={inputId}
          className="sr-only"
          type="file"
          accept=".xlsx"
          disabled={isLoading}
          onChange={(event) => onUpload(event.currentTarget.files?.[0])}
        />
        <div className="grid gap-2 border-t border-slate-200 pt-3">
          <a className="secondary-button w-full" href="./examples/sample-valid.xlsx" download>
            Download Demo Spreadsheet
          </a>
          <a className="secondary-button w-full" href="./examples/sample-with-warnings.xlsx" download>
            Download Warning Spreadsheet
          </a>
        </div>
      </div>
    </section>
  );
}

function ConfigPanel({
  config,
  setConfig,
}: {
  config: ReportConfig;
  setConfig: Dispatch<SetStateAction<ReportConfig>>;
}) {
  return (
    <section className="panel">
      <h2 className="panel-title">Configure</h2>
      <div className="mt-4 space-y-3">
        <TextField label="Report title" value={config.title} onChange={(title) => setConfig((current) => ({ ...current, title }))} />
        <TextField
          label="Company"
          value={config.companyName}
          onChange={(companyName) => setConfig((current) => ({ ...current, companyName }))}
        />
        <TextField
          label="Period label"
          value={config.reportPeriodLabel}
          onChange={(reportPeriodLabel) => setConfig((current) => ({ ...current, reportPeriodLabel }))}
        />
        <SelectField
          label="Amount scale"
          value={config.amountScale}
          options={[
            ["raw", "Raw"],
            ["thousand", "Thousand"],
            ["million", "Million"],
          ]}
          onChange={(amountScale) => setConfig((current) => ({ ...current, amountScale }))}
        />
        <SelectField
          label="P&L view"
          value={config.plViewMode}
          options={[
            ["ytd", "YTD"],
            ["period_activity", "Period activity"],
          ]}
          onChange={(plViewMode) => setConfig((current) => ({ ...current, plViewMode }))}
        />
      </div>
    </section>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <input className="field-input" value={value} onChange={(event) => onChange(event.currentTarget.value)} />
    </label>
  );
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<readonly [T, string]>;
  onChange: (value: T) => void;
}) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <select className="field-input" value={value} onChange={(event) => onChange(event.currentTarget.value as T)}>
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue} value={optionValue}>
            {labelText}
          </option>
        ))}
      </select>
    </label>
  );
}

function StatusBanner({ pipeline }: { pipeline: PipelineState }) {
  const tone =
    pipeline.status === "error"
      ? "border-red-200 bg-red-50 text-red-950"
      : pipeline.status === "ready"
        ? "border-blue-200 bg-blue-50 text-blue-950"
        : "border-slate-200 bg-white text-slate-950";

  return (
    <section className={`rounded-md border p-4 shadow-sm ${tone}`}>
      <h2 className="text-base font-semibold">{pipeline.status === "ready" ? "Workbook ready" : "Status"}</h2>
      <p className="mt-1 text-sm leading-6">{pipeline.message}</p>
    </section>
  );
}

function EmptyState() {
  return (
    <section className="panel min-h-80 content-center">
      <h2 className="text-2xl font-semibold text-slate-950">Ready for the first workbook</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
        Load the bundled sample or upload an Excel workbook containing TB and Mapping sheets. Once parsed, this area becomes
        the validation, statement preview, chart preview, and export workspace.
      </p>
    </section>
  );
}

function DiagnosticsPanel({ diagnostics }: { diagnostics: DiagnosticReport }) {
  const grouped = useMemo(() => groupDiagnostics(diagnostics.items), [diagnostics.items]);

  return (
    <section className="panel">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="panel-title">Validate</h2>
        <div className="grid min-w-0 grid-cols-3 gap-2 text-center text-sm">
          <Metric label="Blocking" value={diagnostics.summary.blocking} tone="text-red-700" />
          <Metric label="Warnings" value={diagnostics.summary.warning} tone="text-slate-700" />
          <Metric label="Info" value={diagnostics.summary.info} tone="text-slate-700" />
        </div>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {(["blocking", "warning", "info"] as const).map((severity) => (
          <DiagnosticGroup key={severity} severity={severity} items={grouped[severity]} />
        ))}
      </div>
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-md border border-slate-200 bg-white px-3 py-2">
      <div className="truncate text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-xl font-semibold ${tone}`}>{value}</div>
    </div>
  );
}

function DiagnosticGroup({ severity, items }: { severity: DiagnosticSeverity; items: Diagnostic[] }) {
  return (
    <div className="diagnostic-group min-w-0 overflow-hidden rounded-md border border-slate-200 bg-slate-50 p-3">
      <h3 className="text-sm font-semibold capitalize text-slate-950">{severity}</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No items.</p>
      ) : (
        <ul className="mt-3 min-w-0 space-y-2">
          {items.map((item, index) => (
            <li className="min-w-0 rounded-md bg-white p-3 text-sm shadow-sm" key={`${item.code}-${index}`}>
              <div className="diagnostic-code break-words font-semibold text-slate-800">{item.code}</div>
              <div className="mt-1 break-words leading-5 text-slate-600">{item.message}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatementPreview({
  statement,
  plViewMode,
  amountScale,
}: {
  statement: StatementModel;
  plViewMode: PlViewMode;
  amountScale: ReportConfig["amountScale"];
}) {
  return (
    <section className="panel">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="panel-title">Preview</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Statements use full-width tables with sticky labels and horizontal period scrolling for desktop screen mode.
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-5">
        <StatementTable
          title="Balance Sheet"
          periods={statement.periods.map((period) => period.reportingDate)}
          lines={statement.statements.balanceSheet.lines.filter((line) => line.includeInParentTotal)}
          amountScale={amountScale}
          valueKey="presentationAmount"
        />
        <StatementTable
          title={plViewMode === "ytd" ? "Profit or Loss - YTD" : "Profit or Loss - Period Activity"}
          periods={statement.periods.map((period) => period.reportingDate)}
          lines={statement.statements.profitOrLoss.lines}
          amountScale={amountScale}
          valueKey={plViewMode === "ytd" ? "ytdAmount" : "periodActivityAmount"}
        />
      </div>
    </section>
  );
}

function StatementTable({
  title,
  periods,
  lines,
  amountScale,
  valueKey,
}: {
  title: string;
  periods: string[];
  lines: StatementLine[];
  amountScale: ReportConfig["amountScale"];
  valueKey: "presentationAmount" | "ytdAmount" | "periodActivityAmount";
}) {
  return (
    <div className="statement-table-card overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-1 border-b border-slate-200 bg-gradient-to-r from-white to-blue-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-base font-semibold text-slate-950">{title}</h3>
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{periods.length} periods</span>
      </div>
      <div className="statement-table-scroll overflow-x-auto">
        <table className="min-w-[920px] table-fixed text-sm">
          <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600 shadow-sm">
            <tr>
              <th className="sticky left-0 z-20 w-72 bg-slate-100 px-4 py-3 text-left font-semibold">Line</th>
              {periods.map((period) => (
                <th className="w-32 px-3 py-3 text-right font-semibold" key={period}>
                  {period}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr
                className={`border-t border-slate-100 ${
                  line.lineType === "header" || line.lineType === "subtotal" ? "bg-slate-50/80" : "bg-white"
                }`}
                key={line.lineId}
              >
                <td
                  className={`sticky left-0 z-10 px-4 py-3 text-left ${
                    line.lineType === "header" || line.lineType === "subtotal" ? "bg-slate-50" : "bg-white"
                  }`}
                >
                  <span
                    className={
                      line.lineType === "header" || line.lineType === "subtotal" ? "font-semibold text-slate-950" : ""
                    }
                  >
                    {line.label.en}
                  </span>
                  <span className="ml-2 text-xs text-slate-400">{line.label.zh}</span>
                </td>
                {periods.map((period) => (
                  <td className="px-3 py-3 text-right tabular-nums text-slate-700" key={period}>
                    {formatAmount(line.amountsByPeriod[period]?.[valueKey] ?? 0, amountScale)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChartPreview({
  chartData,
  amountScale,
  plViewMode,
}: {
  chartData: ChartDataModel;
  amountScale: ReportConfig["amountScale"];
  plViewMode: PlViewMode;
}) {
  return (
    <section className="chart-section rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">D3 Charts</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Hover or focus any mark, KPI, or diagnostic tile to inspect the value behind it.
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-4">
        {chartData.charts.map((chart) => (
          <ChartPanel key={chart.chartId} chart={chart} amountScale={amountScale} plViewMode={plViewMode} />
        ))}
      </div>
    </section>
  );
}

function ChartPanel({
  chart,
  amountScale,
  plViewMode,
}: {
  chart: ChartSpec;
  amountScale: ReportConfig["amountScale"];
  plViewMode: PlViewMode;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    renderChart(containerRef.current, chart, { amountScale, plViewMode });
  }, [amountScale, chart, plViewMode]);

  return (
    <div className="chart-card rounded-lg border border-white/70 bg-white p-4 shadow-sm ring-1 ring-slate-900/10">
      <h3 className="text-base font-semibold text-slate-950">
        {chart.title.en} <span className="text-slate-400">{chart.title.zh}</span>
      </h3>
      <div className="mt-3 min-h-80 rounded-md bg-slate-50/70 p-3" ref={containerRef} />
    </div>
  );
}

function ExportPanel({
  disabled,
  exportMessage,
  onExport,
}: {
  disabled: boolean;
  exportMessage: string;
  onExport: () => void;
}) {
  return (
    <section className="panel">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="panel-title">Export</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Generates one offline HTML file with report JSON, charts, controls, and diagnostics appendix.
          </p>
        </div>
        <button className="primary-button" type="button" disabled={disabled} onClick={onExport}>
          Export Reveal HTML
        </button>
      </div>
      {disabled ? <p className="mt-3 text-sm text-red-700">Blocking diagnostics must be fixed before export.</p> : null}
      {exportMessage ? <p className="mt-3 text-sm text-blue-700">{exportMessage}</p> : null}
    </section>
  );
}

function groupDiagnostics(items: Diagnostic[]): Record<DiagnosticSeverity, Diagnostic[]> {
  return {
    blocking: items.filter((item) => item.severity === "blocking"),
    warning: items.filter((item) => item.severity === "warning"),
    info: items.filter((item) => item.severity === "info"),
  };
}

function readStoredConfig(): ReportConfig {
  if (typeof window === "undefined" || typeof window.localStorage?.getItem !== "function") {
    return defaultConfig;
  }

  const raw = window.localStorage.getItem("trial-balance-reporter:config");

  if (!raw) {
    return defaultConfig;
  }

  try {
    return { ...defaultConfig, ...(JSON.parse(raw) as Partial<ReportConfig>) };
  } catch {
    return defaultConfig;
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
