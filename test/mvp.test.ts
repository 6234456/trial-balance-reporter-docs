import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { buildChartDataModel } from "../src/chart/model";
import { renderChart } from "../src/chart/renderers";
import { buildStatementModel } from "../src/domain/statement";
import { parseCsvWorkbook } from "../src/excel/csvWorkbook";
import { renderRevealReportHtml } from "../src/reveal/renderRevealReportHtml";
import type { ReportConfig } from "../src/types";

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
    expect(html).toContain("renderChart");
    expect(html).toContain("PL_NET_INCOME");
    expect(html).not.toContain("https://");
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
    expect(host.textContent).toContain("vs prior period / 较上期");

    const revenueCard = cards[0];
    expect(revenueCard?.className).toContain("rounded-xl");
    expect(revenueCard?.className).toContain("shadow-md");
    expect(host.innerHTML).not.toMatch(/teal|emerald|amber|rose|#0f766e|#6d5bd0|#f59e0b|#e11d48|#14b8a6/);
    expect(revenueCard?.getAttribute("data-change-absolute")).toBe("+1,150k");
    expect(revenueCard?.getAttribute("data-change-percent")).toBe("+39.0%");
    expect(revenueCard?.textContent).toContain("+1,150k");
    expect(revenueCard?.textContent).toContain("+39.0%");
  });
});
