import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { buildChartDataModel } from "../src/chart/model";
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
      "assets-composition",
      "liabilities-equity-composition",
      "working-capital",
      "diagnostics-summary",
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
});
