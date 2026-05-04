import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { buildChartDataModel } from "../src/chart/model";
import { renderChart } from "../src/chart/renderers";
import { buildStatementModel } from "../src/domain/statement";
import { parseCsvWorkbook } from "../src/excel/csvWorkbook";
import { renderRevealReportHtml } from "../src/reveal/renderRevealReportHtml";
import type { ChartSpec, ReportConfig } from "../src/types";

const root = resolve(import.meta.dirname, "..");

function loadFixture(name: "sample-valid" | "sample-with-warnings") {
  return parseCsvWorkbook({
    tbCsv: readFileSync(resolve(root, "fixtures/csv", name, "TB.csv"), "utf8"),
    mappingCsv: readFileSync(resolve(root, "fixtures/csv", name, "Mapping.csv"), "utf8"),
    sourceName: name,
  });
}

const config: ReportConfig = {
  title: "Board Report",
  companyName: "Demo Manufacturing GmbH",
  reportPeriodLabel: "FY 2025",
  language: "bilingual",
  amountScale: "thousand",
  plViewMode: "ytd",
  themeId: "boardroom-minimal",
  selectedSlideIds: [],
  generatedAt: "2026-05-04T00:00:00.000Z",
};

describe("MVP reporting pipeline", () => {
  it("builds statements and chart data from the valid fixture", () => {
    const parsed = loadFixture("sample-valid");
    const statement = buildStatementModel(parsed);
    const chartData = buildChartDataModel(statement, parsed.diagnostics);

    expect(parsed.diagnostics.summary).toEqual({ blocking: 0, warning: 0, info: 3 });
    expect(statement.currency).toBe("EUR");
    expect(statement.periods.map((period) => period.reportingDate)).toEqual([
      "2024-12-31",
      "2025-03-31",
      "2025-06-30",
      "2025-09-30",
      "2025-12-31",
    ]);
    expect(statement.statements.balanceSheet.linesById.BS_ASSETS?.amountsByPeriod["2025-12-31"]).toMatchObject({
      presentationAmount: 4865000,
      movementAmount: 159000,
    });
    expect(statement.statements.profitOrLoss.linesById.PL_NET_INCOME?.amountsByPeriod["2025-12-31"]).toMatchObject({
      presentationAmount: 375000,
      periodActivityAmount: 139000,
    });
    expect(statement.checks.tbByPeriod["2025-12-31"]?.difference).toBe(0);
    expect(chartData.charts.map((chart) => chart.chartId)).toEqual([
      "kpi-summary",
      "pl-trend",
      "pl-waterfall",
      "balance-composition",
      "working-capital",
      "diagnostics-summary",
    ]);
    expect(chartData.charts.find((chart) => chart.chartId === "balance-composition")).toMatchObject({
      chartType: "paired-stacked-bar",
      title: {
        en: "Assets vs Liabilities & Equity Composition",
        zh: "资产与负债权益构成",
      },
    });
    expect(
      (
        chartData.charts.find((chart) => chart.chartId === "balance-composition")?.data as Record<
          string,
          Array<{ group: string; segments: unknown[] }>
        >
      )["2025-12-31"],
    ).toMatchObject([
      { group: "Assets", segments: expect.arrayContaining([expect.objectContaining({ lineId: "BS_CASH" })]) },
      {
        group: "Liabilities & Equity",
        segments: expect.arrayContaining([expect.objectContaining({ lineId: "BS_CURRENT_RESULT" })]),
      },
    ]);
  });

  it("keeps warning diagnostics for imperfect but reportable workbooks", () => {
    const parsed = loadFixture("sample-with-warnings");
    const statement = buildStatementModel(parsed);

    expect(parsed.diagnostics.summary.blocking).toBe(0);
    expect(parsed.diagnostics.items.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "WARN_UNMAPPED_NON_ZERO_ACCOUNT",
        "WARN_DUPLICATE_ACCOUNT_NAME",
        "WARN_MAPPING_CONFLICT",
        "INFO_UNMAPPED_ZERO_ACCOUNT",
      ]),
    );
    expect(statement.statements.balanceSheet.linesById.BS_CASH?.amountsByPeriod["2025-12-31"]?.presentationAmount).toBe(
      865000,
    );
  });

  it("renders a self-contained Reveal report html document", () => {
    const parsed = loadFixture("sample-valid");
    const statement = buildStatementModel(parsed);
    const chartData = buildChartDataModel(statement, parsed.diagnostics);
    const html = renderRevealReportHtml({ statement, chartData, diagnostics: parsed.diagnostics, config });

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Board Report");
    expect(html).toContain("window.__REPORT_DATA__");
    expect(html).toContain("Reveal.initialize");
    expect(html).toContain('data-slide-id="statement-balance-sheet"');
    expect(html).toContain('data-slide-id="statement-profit-or-loss"');
    expect(html).toContain(".report-table th, .report-table td {");
    expect(html).toContain("font-size: 19.5px;");
    expect(html).toContain("line-height: 1.8;");
    expect(html).toContain(".controls { position: fixed; top: 50%;");
    expect(html).toContain("transform: translateY(-50%);");
    expect(html).toContain(".progress { position: fixed; left: 50%; bottom: 16px;");
    expect(html).not.toContain("grid-template-rows: 1fr auto");
    expect(html).toContain(".reveal section { position: relative; display: none; min-height: 100vh; padding: 124px 72px 48px;");
    expect(html).toContain("h1, h2 { position: absolute; top: 42px; left: 72px; right: 72px;");
    expect(html).toContain(".controls button { width: 44px; height: 44px; border: 0; background: transparent; opacity: 0.45;");
    expect(html).toContain(".controls button:hover, .controls button:focus-visible { opacity: 0.95;");
    expect(html).toContain('.controls button::before { content: "";');
    expect(html).toContain("[data-prev]::before { border-right: 24px solid #0f172a;");
    expect(html).toContain("[data-next]::before { border-left: 24px solid #0f172a;");
    expect(html).toContain('<button type="button" data-prev aria-label="Previous slide"></button>');
    expect(html).toContain('<button type="button" data-next aria-label="Next slide"></button>');
    expect(html).not.toContain(">Previous</button>");
    expect(html).not.toContain(">Next</button>");
    for (const chart of chartData.charts) {
      expect(html).toContain(`data-chart-id="${chart.chartId}"`);
    }
    expect(html).toContain('class="chart-svg"');
    expect(html).toContain("Assets vs Liabilities");
    expect(html).toContain("Equity Composition");
    expect(html).toContain("Working Capital");
    expect(html).toContain("PL_NET_INCOME");
    expect(html).not.toContain('id="chart-host"');
    expect(html).not.toContain("function renderChart");
    expect(html).not.toContain("https://");
  });

  it("renders compact Reveal KPI cards with icons and percent movement", () => {
    const parsed = loadFixture("sample-valid");
    const statement = buildStatementModel(parsed);
    const chartData = buildChartDataModel(statement, parsed.diagnostics);
    const html = renderRevealReportHtml({ statement, chartData, diagnostics: parsed.diagnostics, config });
    const host = document.createElement("div");
    host.innerHTML = html;

    const kpiSlide = host.querySelector('[data-slide-id="chart-kpi-summary"]');
    const cards = kpiSlide?.querySelectorAll(".kpi-card") ?? [];
    const revenueCard = cards[0];

    expect(kpiSlide?.querySelector(".kpi-grid")?.getAttribute("style")).toContain("minmax(160px,1fr)");
    expect(cards).toHaveLength(5);
    expect(kpiSlide?.querySelectorAll(".kpi-icon")).toHaveLength(5);
    expect(kpiSlide?.querySelectorAll(".kpi-change-percent")).toHaveLength(5);
    expect(revenueCard?.querySelector(".kpi-change-absolute")?.textContent).toBe("+1,150k");
    expect(revenueCard?.querySelector(".kpi-change-percent")?.textContent).toBe("39.0%");
    expect(revenueCard?.textContent).not.toContain("+39.0%");
  });

  it("renders tooltip targets for every chart type", () => {
    const parsed = loadFixture("sample-valid");
    const statement = buildStatementModel(parsed);
    const chartData = buildChartDataModel(statement, parsed.diagnostics);

    for (const chart of chartData.charts) {
      const host = document.createElement("div");
      Object.defineProperty(host, "clientWidth", { configurable: true, value: 720 });

      renderChart(host, chart, { amountScale: "thousand", plViewMode: "ytd" });

      expect(host.querySelector(".chart-tooltip")).toBeTruthy();
      expect(host.querySelector("[data-tooltip]")).toBeTruthy();
    }
  });

  it("renders the P&L trend with smooth lines and merged period tooltips", () => {
    const parsed = loadFixture("sample-valid");
    const statement = buildStatementModel(parsed);
    const chartData = buildChartDataModel(statement, parsed.diagnostics);
    const chart = chartData.charts.find((item) => item.chartId === "pl-trend");
    const host = document.createElement("div");
    Object.defineProperty(host, "clientWidth", { configurable: true, value: 720 });

    if (!chart) {
      throw new Error("pl-trend chart not found");
    }

    renderChart(host, chart, { amountScale: "thousand", plViewMode: "ytd" });

    const smoothLines = host.querySelectorAll(".trend-line-path");
    const baselines = host.querySelectorAll(".trend-baseline");
    const mergedTooltips = host.querySelectorAll(".trend-hitbox[data-tooltip]");

    expect(smoothLines).toHaveLength(3);
    smoothLines.forEach((line) => {
      expect(line.getAttribute("d")).toContain("C");
    });
    expect(baselines).toHaveLength(statement.periods.length);
    expect(mergedTooltips).toHaveLength(statement.periods.length);
    expect(mergedTooltips[0]?.getAttribute("data-tooltip")).toContain("Revenue");
    expect(mergedTooltips[0]?.getAttribute("data-tooltip")).toContain("Gross Profit");
    expect(mergedTooltips[0]?.getAttribute("data-tooltip")).toContain("Net Income");
  });

  it("renders balance composition without left values and with outside segment labels", () => {
    const parsed = loadFixture("sample-valid");
    const statement = buildStatementModel(parsed);
    const chartData = buildChartDataModel(statement, parsed.diagnostics);
    const chart = chartData.charts.find((item) => item.chartId === "balance-composition");
    const host = document.createElement("div");
    Object.defineProperty(host, "clientWidth", { configurable: true, value: 720 });

    if (!chart) {
      throw new Error("balance-composition chart not found");
    }

    renderChart(host, chart, { amountScale: "thousand", plViewMode: "ytd" });

    const yAxis = host.querySelector(".y-axis");
    const labels = [...host.querySelectorAll(".paired-largest-segment-label")];
    const assetsLabel = labels.find((label) => label.getAttribute("data-group") === "Assets");
    const liabilitiesLabel = labels.find((label) => label.getAttribute("data-group") === "Liabilities & Equity");

    expect(yAxis).toBeTruthy();
    expect(yAxis?.getAttribute("transform")).toBe("translate(72,0)");
    expect(yAxis?.querySelectorAll(".tick").length).toBe(0);
    expect(labels).toHaveLength(2);
    expect(assetsLabel?.textContent).toContain("Property, plant and equipment");
    expect(assetsLabel?.getAttribute("data-horizontal-bias")).toBe("left");
    expect(liabilitiesLabel?.textContent).toContain("Retained earnings");
    expect(liabilitiesLabel?.getAttribute("data-horizontal-bias")).toBe("right");
    expect(assetsLabel?.getAttribute("text-anchor")).toBe("end");
    expect(liabilitiesLabel?.getAttribute("text-anchor")).toBe("start");
    expect(Number(assetsLabel?.getAttribute("x"))).toBeLessThan(Number(assetsLabel?.getAttribute("data-bar-left")));
    expect(Number(liabilitiesLabel?.getAttribute("x"))).toBeGreaterThan(Number(liabilitiesLabel?.getAttribute("data-bar-right")));
    expect(Number(assetsLabel?.getAttribute("x"))).toBeLessThan(Number(liabilitiesLabel?.getAttribute("x")));
  });

  it("renders working capital as a step line with padded non-negative range", () => {
    const chart: ChartSpec = {
      chartId: "working-capital",
      chartType: "working-capital",
      title: { en: "Working Capital", zh: "营运资本" },
      sourceLineIds: ["BS_WORKING_CAPITAL"],
      data: [
        { reportingDate: "2025-03-31", workingCapital: 2 },
        { reportingDate: "2025-06-30", workingCapital: 52 },
        { reportingDate: "2025-09-30", workingCapital: 102 },
      ],
    };
    const host = document.createElement("div");
    Object.defineProperty(host, "clientWidth", { configurable: true, value: 720 });

    renderChart(host, chart, { amountScale: "raw", plViewMode: "ytd" });

    const workingCapitalLine = host.querySelector(".working-capital-line");
    const pathData = workingCapitalLine?.getAttribute("d") ?? "";
    const markers = [...host.querySelectorAll(".working-capital-marker")];
    expect(workingCapitalLine).toBeTruthy();
    expect(pathData).toContain("H");
    expect(pathData).toContain("V");
    expect(pathData).not.toContain("C");
    expect(host.querySelector(".working-capital-step-line")).toBeNull();
    expect(host.querySelector("rect:not(.working-capital-hitbox)")).toBeNull();
    expect(markers[0]?.getAttribute("cy")).toBeCloseTo(239.7, 1);
    expect(markers[2]?.getAttribute("cy")).toBeCloseTo(26.4, 1);
    expect(host.querySelectorAll(".working-capital-hitbox[data-tooltip]")).toHaveLength(3);
  });

  it("keeps demo year-end working capital points on distinct x coordinates", () => {
    const parsed = loadFixture("sample-valid");
    const statement = buildStatementModel(parsed);
    const chartData = buildChartDataModel(statement, parsed.diagnostics);
    const chart = chartData.charts.find((item) => item.chartId === "working-capital");
    const host = document.createElement("div");
    Object.defineProperty(host, "clientWidth", { configurable: true, value: 720 });

    if (!chart) {
      throw new Error("working-capital chart not found");
    }

    renderChart(host, chart, { amountScale: "thousand", plViewMode: "ytd" });

    const markerXPositions = [...host.querySelectorAll(".working-capital-marker")].map((marker) => marker.getAttribute("cx"));
    const tickLabels = [...host.querySelectorAll(".x-axis .tick text")].map((label) => label.textContent);

    expect(markerXPositions).toHaveLength(statement.periods.length);
    expect(new Set(markerXPositions).size).toBe(statement.periods.length);
    expect(tickLabels).toContain("2024-12-31");
    expect(tickLabels).toContain("2025-12-31");
  });

  it("renders KPI cards with icons and prior-period movement", () => {
    const parsed = loadFixture("sample-valid");
    const statement = buildStatementModel(parsed);
    const chartData = buildChartDataModel(statement, parsed.diagnostics);
    const chart = chartData.charts.find((item) => item.chartId === "kpi-summary");
    const host = document.createElement("div");

    if (!chart) {
      throw new Error("kpi-summary chart not found");
    }

    renderChart(host, chart, { amountScale: "thousand", plViewMode: "ytd" });

    const cards = host.querySelectorAll(".kpi-card");
    expect(cards).toHaveLength(5);
    expect(host.querySelectorAll(".kpi-icon")).toHaveLength(5);
    expect(host.textContent).not.toContain("vs prior period / 较上期");
    expect(cards[0]?.parentElement?.className).toContain("minmax(160px,1fr)");

    const revenueCard = cards[0];
    const revenueChange = revenueCard?.querySelector(".kpi-change");
    const revenueAbsolute = revenueCard?.querySelector(".kpi-change-absolute");
    const revenuePercent = revenueCard?.querySelector(".kpi-change-percent");
    expect(revenueCard?.className).toContain("rounded-xl");
    expect(revenueCard?.className).toContain("shadow-md");
    expect(revenueCard?.className).toContain("min-w-0");
    expect(revenueChange?.className).toContain("text-blue-700");
    expect(revenueChange?.className).not.toContain("bg-blue-50");
    expect(revenueAbsolute?.className).toContain("text-xl");
    expect(revenuePercent?.className).toContain("text-xs");
    expect(host.innerHTML).not.toMatch(/teal|emerald|amber|rose|#0f766e|#6d5bd0|#f59e0b|#e11d48|#14b8a6/);
    expect(revenueCard?.getAttribute("data-change-absolute")).toBe("+1,150k");
    expect(revenueCard?.getAttribute("data-change-percent")).toBe("39.0%");
    expect(revenueCard?.textContent).toContain("+1,150k");
    expect(revenueCard?.textContent).toContain("39.0%");
    expect(revenueCard?.textContent).not.toContain("+39.0%");
  });

  it("uses gray compact movement styling for declining KPIs", () => {
    const chart: ChartSpec = {
      chartId: "kpi-summary",
      chartType: "kpi-cards",
      title: { en: "Executive KPIs", zh: "核心财务指标" },
      sourceLineIds: [],
      data: {
        "2025-03-31": { revenue: 1000, grossProfit: 800, netIncome: 500, totalAssets: 3000, cash: 600 },
        "2025-06-30": { revenue: 750, grossProfit: 700, netIncome: 450, totalAssets: 2900, cash: 500 },
      },
    };
    const host = document.createElement("div");

    renderChart(host, chart, { amountScale: "raw", plViewMode: "ytd" });

    const revenueCard = host.querySelector(".kpi-card");
    const revenueChange = revenueCard?.querySelector(".kpi-change");
    const revenuePercent = revenueCard?.querySelector(".kpi-change-percent");

    expect(revenueChange?.className).toContain("text-slate-700");
    expect(revenueChange?.className).not.toContain("text-blue-700");
    expect(revenueCard?.getAttribute("data-change-absolute")).toBe("-250");
    expect(revenueCard?.getAttribute("data-change-percent")).toBe("25.0%");
    expect(revenuePercent?.textContent).toBe("25.0%");
    expect(revenuePercent?.textContent).not.toContain("-");
  });
});
