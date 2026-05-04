import type { ChartDataModel, ChartSpec, DiagnosticReport, StatementLine, StatementModel } from "../types";

export function buildChartDataModel(statement: StatementModel, diagnostics: DiagnosticReport): ChartDataModel {
  return {
    schemaVersion: "1.0",
    sourceFixture: statement.sourceFixture,
    charts: [
      buildKpiSummary(statement),
      buildPlTrend(statement),
      buildPlWaterfall(statement),
      buildComposition(statement, "assets-composition", "Assets Composition", "资产构成", [
        "BS_CASH",
        "BS_AR",
        "BS_INVENTORY",
        "BS_PPE",
      ]),
      buildComposition(
        statement,
        "liabilities-equity-composition",
        "Liabilities & Equity Composition",
        "负债与权益构成",
        ["BS_AP", "BS_LOANS", "BS_SHARE_CAPITAL", "BS_RETAINED_EARNINGS", "BS_CURRENT_RESULT"],
      ),
      buildWorkingCapital(statement),
      buildDiagnosticsSummary(diagnostics),
    ],
  };
}

function buildKpiSummary(statement: StatementModel): ChartSpec {
  const data = Object.fromEntries(
    statement.periods.map((period) => [
      period.reportingDate,
      {
        revenue: amount(statement.statements.profitOrLoss.linesById.PL_REVENUE, period.reportingDate, "presentationAmount"),
        grossProfit: amount(statement.statements.profitOrLoss.linesById.PL_GROSS_PROFIT, period.reportingDate, "presentationAmount"),
        netIncome: amount(statement.statements.profitOrLoss.linesById.PL_NET_INCOME, period.reportingDate, "presentationAmount"),
        totalAssets: amount(statement.statements.balanceSheet.linesById.BS_ASSETS, period.reportingDate, "presentationAmount"),
        cash: amount(statement.statements.balanceSheet.linesById.BS_CASH, period.reportingDate, "presentationAmount"),
      },
    ]),
  );

  return {
    chartId: "kpi-summary",
    chartType: "kpi-cards",
    title: { en: "Executive KPIs", zh: "核心财务指标" },
    sourceLineIds: ["PL_REVENUE", "PL_GROSS_PROFIT", "PL_NET_INCOME", "BS_ASSETS", "BS_CASH"],
    data,
  };
}

function buildPlTrend(statement: StatementModel): ChartSpec {
  const series = [
    ["Revenue", "PL_REVENUE"],
    ["Gross Profit", "PL_GROSS_PROFIT"],
    ["Net Income", "PL_NET_INCOME"],
  ] as const;

  return {
    chartId: "pl-trend",
    chartType: "trend-line",
    title: { en: "Revenue / Gross Profit / Net Income Trend", zh: "收入 / 毛利 / 净利润趋势" },
    sourceLineIds: series.map(([, lineId]) => lineId),
    data: series.flatMap(([name, lineId]) =>
      statement.periods.map((period) => ({
        reportingDate: period.reportingDate,
        series: name,
        lineId,
        ytdAmount: amount(statement.statements.profitOrLoss.linesById[lineId], period.reportingDate, "ytdAmount"),
        periodActivityAmount: amount(
          statement.statements.profitOrLoss.linesById[lineId],
          period.reportingDate,
          "periodActivityAmount",
        ),
      })),
    ),
  };
}

function buildPlWaterfall(statement: StatementModel): ChartSpec {
  const lines = [
    ["PL_REVENUE", "Revenue", 1],
    ["PL_COGS", "COGS", -1],
    ["PL_OPEX", "OPEX", -1],
    ["PL_FINANCE_COST", "Finance costs", -1],
    ["PL_TAX", "Income tax", -1],
    ["PL_NET_INCOME", "Net income", 1],
  ] as const;

  return {
    chartId: "pl-waterfall",
    chartType: "waterfall",
    title: { en: "P&L Waterfall", zh: "损益瀑布图" },
    sourceLineIds: lines.map(([lineId]) => lineId),
    data: Object.fromEntries(
      statement.periods.map((period) => [
        period.reportingDate,
        lines.map(([lineId, label, sign]) => ({
          lineId,
          label,
          amount: amount(statement.statements.profitOrLoss.linesById[lineId], period.reportingDate, "presentationAmount") * sign,
          ...(lineId === "PL_NET_INCOME" ? { isTotal: true } : {}),
        })),
      ]),
    ),
  };
}

function buildComposition(
  statement: StatementModel,
  chartId: string,
  titleEn: string,
  titleZh: string,
  lineIds: string[],
): ChartSpec {
  return {
    chartId,
    chartType: "composition",
    title: { en: titleEn, zh: titleZh },
    sourceLineIds: lineIds,
    data: Object.fromEntries(
      statement.periods.map((period) => [
        period.reportingDate,
        lineIds.map((lineId) => {
          const line = statement.statements.balanceSheet.linesById[lineId];
          return {
            lineId,
            label: line?.label.en ?? lineId,
            amount: amount(line, period.reportingDate, "presentationAmount"),
          };
        }),
      ]),
    ),
  };
}

function buildWorkingCapital(statement: StatementModel): ChartSpec {
  const lineIds = ["BS_AR", "BS_INVENTORY", "BS_AP", "BS_WORKING_CAPITAL"];

  return {
    chartId: "working-capital",
    chartType: "working-capital",
    title: { en: "Working Capital", zh: "营运资本" },
    sourceLineIds: lineIds,
    data: statement.periods.map((period) => ({
      reportingDate: period.reportingDate,
      receivables: amount(statement.statements.balanceSheet.linesById.BS_AR, period.reportingDate, "presentationAmount"),
      inventory: amount(statement.statements.balanceSheet.linesById.BS_INVENTORY, period.reportingDate, "presentationAmount"),
      payables: amount(statement.statements.balanceSheet.linesById.BS_AP, period.reportingDate, "presentationAmount"),
      workingCapital: amount(
        statement.statements.balanceSheet.linesById.BS_WORKING_CAPITAL,
        period.reportingDate,
        "presentationAmount",
      ),
    })),
  };
}

function buildDiagnosticsSummary(diagnostics: DiagnosticReport): ChartSpec {
  return {
    chartId: "diagnostics-summary",
    chartType: "diagnostics-summary",
    title: { en: "Diagnostics Summary", zh: "诊断汇总" },
    sourceLineIds: [],
    data: diagnostics.summary,
  };
}

function amount(
  line: StatementLine | undefined,
  period: string,
  key: "presentationAmount" | "ytdAmount" | "periodActivityAmount",
): number {
  return line?.amountsByPeriod[period]?.[key] ?? 0;
}
