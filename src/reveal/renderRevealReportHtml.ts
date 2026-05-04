import * as d3 from "d3";

import type { AmountScale, ChartDataModel, ChartSpec, DiagnosticReport, ReportConfig, StatementLine, StatementModel } from "../types";

type RenderInput = {
  statement: StatementModel;
  chartData: ChartDataModel;
  diagnostics: DiagnosticReport;
  config: ReportConfig;
};

type ChartRenderOptions = {
  amountScale: AmountScale;
  plViewMode: ReportConfig["plViewMode"];
};

const chartWidth = 960;
const chartHeight = 420;
const fallbackColor = "#2563eb";
const palette = [fallbackColor, "#0f172a", "#1e40af", "#334155", "#64748b", "#94a3b8"];
const negativeColor = "#334155";

export function renderRevealReportHtml(input: RenderInput): string {
  const payload = escapeScriptJson({
    config: input.config,
    statement: input.statement,
    chartData: input.chartData,
    diagnostics: input.diagnostics,
  });
  const latestPeriod = input.statement.periods.at(-1)?.reportingDate ?? "";
  const chartOptions: ChartRenderOptions = {
    amountScale: input.config.amountScale,
    plViewMode: input.config.plViewMode,
  };
  const slides = [
    renderCoverSlide(input.config, latestPeriod),
    renderStatementSlide(
      "statement-balance-sheet",
      "Balance Sheet",
      input.statement,
      input.statement.statements.balanceSheet.lines.filter((line) => line.includeInParentTotal),
      "presentationAmount",
      chartOptions.amountScale,
    ),
    renderStatementSlide(
      "statement-profit-or-loss",
      input.config.plViewMode === "ytd" ? "Profit or Loss - YTD" : "Profit or Loss - Period Activity",
      input.statement,
      input.statement.statements.profitOrLoss.lines,
      input.config.plViewMode === "ytd" ? "ytdAmount" : "periodActivityAmount",
      chartOptions.amountScale,
    ),
    ...input.chartData.charts.map((chart) => renderChartSlide(chart, chartOptions)),
    renderDiagnosticsSlide(input.diagnostics),
  ];

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(input.config.title)}</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8fafc; color: #0f172a; }
    body { margin: 0; background: #f8fafc; }
    .reveal { min-height: 100vh; }
    .slides { min-height: 100vh; display: grid; }
    .reveal section { display: none; min-height: 100vh; padding: 42px 72px; box-sizing: border-box; }
    .reveal section.active { display: grid; align-content: center; gap: 20px; }
    h1, h2 { margin: 0; line-height: 1.05; letter-spacing: 0; }
    h1 { font-size: clamp(40px, 7vw, 84px); max-width: 920px; }
    h2 { font-size: clamp(28px, 4vw, 48px); }
    p { margin: 0; color: #475569; font-size: 18px; line-height: 1.7; }
    table { border-collapse: collapse; width: 100%; background: white; border: 1px solid #e2e8f0; }
    th, td { border-bottom: 1px solid #e2e8f0; text-align: right; }
    th:first-child, td:first-child { text-align: left; }
    .report-table-wrap { max-width: 100%; overflow: hidden; border-radius: 8px; box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06); }
    .report-table th, .report-table td { padding: 12px 14px; font-size: 19.5px; line-height: 1.8; }
    .report-table td:first-child { min-width: 420px; }
    .report-table td span { font-size: 18px; }
    .report-table th { background: #f1f5f9; color: #475569; font-weight: 700; }
    .line-header td, .line-subtotal td { background: #f8fafc; color: #0f172a; font-weight: 700; }
    .chart-frame { min-height: 440px; border: 1px solid #e2e8f0; border-radius: 8px; background: white; padding: 18px; box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06); }
    .chart-svg { display: block; width: 100%; height: auto; overflow: visible; }
    .chart-grid { stroke: #e2e8f0; stroke-width: 1; }
    .axis-line { stroke: #cbd5e1; stroke-width: 1; }
    .tick-label { fill: #64748b; font-size: 11px; }
    .legend-label { fill: #475569; font-size: 12px; }
    .card-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; }
    .card { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06); }
    .label { text-transform: uppercase; font-size: 12px; font-weight: 700; color: #64748b; }
    .value { margin-top: 8px; font-size: 28px; font-weight: 700; }
    .chart-frame-kpi-cards { min-height: 300px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; align-items: stretch; }
    .kpi-card { min-width: 0; border: 1px solid #e2e8f0; border-radius: 12px; background: white; padding: 12px; box-shadow: 0 10px 22px rgba(15, 23, 42, 0.08); }
    .kpi-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; min-width: 0; }
    .kpi-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-transform: uppercase; font-size: 11px; font-weight: 700; color: #64748b; }
    .kpi-value { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 4px; color: #020617; font-size: 28px; font-weight: 700; }
    .kpi-icon { display: flex; width: 32px; height: 32px; flex: 0 0 auto; align-items: center; justify-content: center; border-radius: 8px; background: #0f172a; color: white; box-shadow: 0 2px 6px rgba(15, 23, 42, 0.16); }
    .kpi-icon svg { width: 18px; height: 18px; }
    .kpi-change { display: flex; min-width: 0; align-items: flex-end; justify-content: space-between; gap: 8px; margin-top: 12px; border-top: 1px solid #f1f5f9; padding-top: 8px; font-variant-numeric: tabular-nums; }
    .kpi-change-absolute { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 20px; font-weight: 700; }
    .kpi-change-percent { flex: 0 0 auto; font-size: 12px; font-weight: 700; }
    .controls { position: fixed; top: 50%; left: 0; right: 0; z-index: 20; display: flex; align-items: center; justify-content: space-between; padding: 0 14px; pointer-events: none; transform: translateY(-50%); }
    .progress { position: fixed; left: 50%; bottom: 16px; z-index: 20; transform: translateX(-50%); border: 1px solid #e2e8f0; border-radius: 999px; background: rgba(255, 255, 255, 0.92); padding: 6px 12px; color: #475569; font-size: 13px; font-weight: 700; box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08); }
    button { min-height: 44px; border: 1px solid #cbd5e1; border-radius: 999px; background: rgba(255, 255, 255, 0.92); padding: 0 14px; font: inherit; font-weight: 700; color: #0f172a; box-shadow: 0 8px 18px rgba(15, 23, 42, 0.1); pointer-events: auto; }
    @media print { .controls, .progress { display: none; } .reveal section { display: block; break-after: page; min-height: 100vh; } }
  </style>
</head>
<body>
  <div class="reveal">
    <div class="slides">
      ${slides.join("\n      ")}
    </div>
    <div class="controls">
      <button type="button" data-prev>Previous</button>
      <button type="button" data-next>Next</button>
    </div>
    <span class="progress" data-progress>1 / ${slides.length}</span>
  </div>
  <script>
    window.__REPORT_DATA__ = ${payload};
    var Reveal = {
      index: 0,
      initialize: function() {
        var sections = Array.prototype.slice.call(document.querySelectorAll(".reveal .slides section"));
        var progress = document.querySelector("[data-progress]");
        function show(index) {
          Reveal.index = Math.max(0, Math.min(index, sections.length - 1));
          sections.forEach(function(section, sectionIndex) { section.classList.toggle("active", sectionIndex === Reveal.index); });
          progress.textContent = (Reveal.index + 1) + " / " + sections.length;
        }
        document.querySelector("[data-prev]").addEventListener("click", function() { show(Reveal.index - 1); });
        document.querySelector("[data-next]").addEventListener("click", function() { show(Reveal.index + 1); });
        document.addEventListener("keydown", function(event) {
          if (event.key === "ArrowRight") show(Reveal.index + 1);
          if (event.key === "ArrowLeft") show(Reveal.index - 1);
        });
        show(0);
      }
    };
    Reveal.initialize();
  </script>
</body>
</html>`;
}

function renderCoverSlide(config: ReportConfig, latestPeriod: string): string {
  return `<section class="active" data-slide-id="cover">
        <h1>${escapeHtml(config.title)}</h1>
        <p>${escapeHtml(config.companyName)} · ${escapeHtml(config.reportPeriodLabel)} · ${escapeHtml(latestPeriod)}</p>
      </section>`;
}

function renderStatementSlide(
  slideId: string,
  title: string,
  statement: StatementModel,
  lines: StatementLine[],
  valueKey: "presentationAmount" | "ytdAmount" | "periodActivityAmount",
  amountScale: AmountScale,
): string {
  const periods = statement.periods.map((period) => period.reportingDate);

  return `<section data-slide-id="${slideId}">
        <h2>${escapeHtml(title)}</h2>
        <div class="report-table-wrap">
          <table class="report-table">
            <thead><tr><th>Line</th>${periods.map((period) => `<th>${escapeHtml(period)}</th>`).join("")}</tr></thead>
            <tbody>${lines
              .map((line) => {
                const rowClass =
                  line.lineType === "header" ? "line-header" : line.lineType === "subtotal" ? "line-subtotal" : "line-detail";
                return `<tr class="${rowClass}"><td>${escapeHtml(line.label.en)} <span style="color:#94a3b8">${escapeHtml(
                  line.label.zh,
                )}</span></td>${periods
                  .map((period) => `<td>${formatAmount(line.amountsByPeriod[period]?.[valueKey] ?? 0, amountScale)}</td>`)
                  .join("")}</tr>`;
              })
              .join("")}</tbody>
          </table>
        </div>
      </section>`;
}

function renderChartSlide(chart: ChartSpec, options: ChartRenderOptions): string {
  return `<section data-slide-id="chart-${escapeHtml(chart.chartId)}">
        <h2>${escapeHtml(chart.title.en)} <span style="color:#94a3b8">${escapeHtml(chart.title.zh)}</span></h2>
        <div class="chart-frame chart-frame-${escapeHtml(chart.chartType)}" data-chart-id="${escapeHtml(chart.chartId)}">
          ${renderChartFigure(chart, options)}
        </div>
      </section>`;
}

function renderChartFigure(chart: ChartSpec, options: ChartRenderOptions): string {
  if (chart.chartType === "kpi-cards") {
    return renderKpiCards(chart, options);
  }

  if (chart.chartType === "diagnostics-summary") {
    return renderDiagnosticsCards(chart);
  }

  if (chart.chartType === "trend-line") {
    return renderTrendChart(chart, options);
  }

  if (chart.chartType === "waterfall" || chart.chartType === "composition") {
    return renderBarChart(chart, options);
  }

  if (chart.chartType === "paired-stacked-bar") {
    return renderPairedStackedBarChart(chart);
  }

  if (chart.chartType === "working-capital") {
    return renderWorkingCapitalChart(chart, options);
  }

  return "";
}

function renderKpiCards(chart: ChartSpec, options: ChartRenderOptions): string {
  const data = chart.data as Record<string, Record<string, number>>;
  const sortedDates = Object.keys(data).sort();
  const latestDate = sortedDates.at(-1);
  const previousDate = sortedDates.at(-2);
  const latest = latestDate ? (data[latestDate] ?? {}) : {};
  const previous = previousDate ? (data[previousDate] ?? {}) : {};
  const items = [
    ["Revenue", "revenue", "trend"],
    ["Gross profit", "grossProfit", "margin"],
    ["Net income", "netIncome", "income"],
    ["Total assets", "totalAssets", "assets"],
    ["Cash", "cash", "cash"],
  ] as const;

  return `<div class="kpi-grid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr))">${items
    .map(([label, key, icon]) => {
      const value = latest[key] ?? 0;
      const change = value - (previous[key] ?? 0);
      const previousValue = previous[key] ?? 0;
      const percentChange = previousValue === 0 ? null : change / Math.abs(previousValue);
      const tone = change >= 0 ? "#2563eb" : "#475569";
      const changeText = formatSignedAmount(change, options.amountScale);
      const percentText = formatPercentMagnitude(percentChange);

      return `<div class="kpi-card" data-change-absolute="${escapeHtml(changeText)}" data-change-percent="${escapeHtml(
        percentText,
      )}"><div class="kpi-card-top"><div style="min-width:0"><div class="kpi-label">${escapeHtml(
        label,
      )}</div><div class="kpi-value">${formatAmount(
        value,
        options.amountScale,
      )}</div></div><div class="kpi-icon" aria-hidden="true">${renderKpiIcon(icon)}</div></div><div class="kpi-change" style="color:${tone}"><span class="kpi-change-absolute">${escapeHtml(
        changeText,
      )}</span><span class="kpi-change-percent">${escapeHtml(percentText)}</span></div></div>`;
    })
    .join("")}</div>`;
}

function renderDiagnosticsCards(chart: ChartSpec): string {
  const data = chart.data as Record<string, number>;

  return `<div class="card-grid">${["blocking", "warning", "info"]
    .map(
      (key) =>
        `<div class="card"><div class="label">${escapeHtml(key)}</div><div class="value">${data[key] ?? 0}</div></div>`,
    )
    .join("")}</div>`;
}

function renderTrendChart(chart: ChartSpec, options: ChartRenderOptions): string {
  type TrendDatum = { reportingDate: string; series: string; ytdAmount: number; periodActivityAmount: number };
  const data = chart.data as TrendDatum[];
  const key = options.plViewMode === "period_activity" ? "periodActivityAmount" : "ytdAmount";
  const margin = { top: 28, right: 34, bottom: 64, left: 82 };
  const dates = [...new Set(data.map((item) => item.reportingDate))];
  const series = [...new Set(data.map((item) => item.series))];
  const x = d3.scalePoint<string>().domain(dates).range([margin.left, chartWidth - margin.right]);
  const extent = d3.extent(data, (item) => item[key]);
  const y = d3
    .scaleLinear()
    .domain([Math.min(0, extent[0] ?? 0), Math.max(0, extent[1] ?? 0)])
    .nice()
    .range([chartHeight - margin.bottom, margin.top]);
  const line = d3
    .line<TrendDatum>()
    .curve(d3.curveMonotoneX)
    .x((item) => x(item.reportingDate) ?? 0)
    .y((item) => y(item[key]));
  const baselines = dates
    .map(
      (date) =>
        `<line x1="${round(x(date) ?? 0)}" x2="${round(x(date) ?? 0)}" y1="${margin.top}" y2="${
          chartHeight - margin.bottom
        }" stroke="#e2e8f0" />`,
    )
    .join("");
  const paths = series
    .map((seriesName, index) => {
      const seriesData = data.filter((item) => item.series === seriesName);
      const color = palette[index % palette.length] ?? fallbackColor;
      const markers = seriesData
        .map(
          (item) =>
            `<circle cx="${round(x(item.reportingDate) ?? 0)}" cy="${round(y(item[key]))}" r="4" fill="${color}" stroke="#fff" stroke-width="1.5" />`,
        )
        .join("");

      return `<path d="${escapeHtml(line(seriesData) ?? "")}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />${markers}`;
    })
    .join("");

  return renderSvg(
    `${renderYAxis(y, margin, options.amountScale)}${renderXAxis(dates, x, chartHeight - margin.bottom)}${baselines}${paths}${renderLegend(
      series,
    )}`,
  );
}

function renderBarChart(chart: ChartSpec, options: ChartRenderOptions): string {
  const dataByPeriod = chart.data as Record<string, Array<{ label: string; amount: number }>>;
  const latestDate = Object.keys(dataByPeriod).sort().at(-1) ?? "";
  const data = dataByPeriod[latestDate] ?? [];
  const margin = { top: 28, right: 34, bottom: 72, left: 82 };
  const x = d3
    .scaleBand<string>()
    .domain(data.map((item) => item.label))
    .range([margin.left, chartWidth - margin.right])
    .padding(0.28);
  const extent = d3.extent(data, (item) => item.amount);
  const y = d3
    .scaleLinear()
    .domain([Math.min(0, extent[0] ?? 0), Math.max(0, extent[1] ?? 0)])
    .nice()
    .range([chartHeight - margin.bottom, margin.top]);
  const bars = data
    .map((item, index) => {
      const color = item.amount < 0 ? negativeColor : (palette[index % palette.length] ?? fallbackColor);
      const barX = x(item.label) ?? margin.left;
      const barY = y(Math.max(0, item.amount));
      const barHeight = Math.abs(y(item.amount) - y(0));

      return `<rect x="${round(barX)}" y="${round(barY)}" width="${round(x.bandwidth())}" height="${round(
        barHeight,
      )}" rx="4" fill="${color}" />`;
    })
    .join("");

  return renderSvg(`${renderYAxis(y, margin, options.amountScale)}${renderXAxis(data.map((item) => item.label), x, chartHeight - margin.bottom)}${bars}`);
}

function renderPairedStackedBarChart(chart: ChartSpec): string {
  const dataByPeriod = chart.data as Record<
    string,
    Array<{ group: string; label: string; segments: Array<{ lineId: string; label: string; amount: number }> }>
  >;
  const latestDate = Object.keys(dataByPeriod).sort().at(-1) ?? "";
  const groups = dataByPeriod[latestDate] ?? [];
  const margin = { top: 28, right: 210, bottom: 64, left: 110 };
  const totals = groups.map((group) => d3.sum(group.segments, (segment) => Math.max(0, segment.amount)));
  const x = d3
    .scaleBand<string>()
    .domain(groups.map((group) => group.label))
    .range([margin.left, chartWidth - margin.right])
    .padding(0.44);
  const y = d3
    .scaleLinear()
    .domain([0, d3.max(totals) ?? 0])
    .nice()
    .range([chartHeight - margin.bottom, margin.top]);
  const colorByLineId = new Map<string, string>();
  chart.sourceLineIds.forEach((lineId, index) => {
    colorByLineId.set(lineId, palette[index % palette.length] ?? fallbackColor);
  });
  const bars = groups
    .map((group, groupIndex) => {
      const xPosition = x(group.label) ?? margin.left;
      let cumulative = 0;
      const largestSegment = findLargestStackSegment(group.segments);
      const segments = group.segments
        .map((segment) => {
          const start = cumulative;
          const amount = Math.max(0, segment.amount);
          const end = cumulative + amount;
          cumulative = end;

          return `<rect x="${round(xPosition)}" y="${round(y(end))}" width="${round(x.bandwidth())}" height="${round(
            Math.max(1, y(start) - y(end)),
          )}" rx="4" fill="${colorByLineId.get(segment.lineId) ?? fallbackColor}" stroke="#fff" stroke-width="1" />`;
        })
        .join("");

      if (!largestSegment || largestSegment.amount <= 0) {
        return segments;
      }

      const isLeft = groupIndex === 0;
      const labelX = isLeft ? xPosition - 12 : xPosition + x.bandwidth() + 12;
      const labelAnchor = isLeft ? "end" : "start";
      const label = `<text class="paired-largest-segment-label" x="${round(labelX)}" y="${round(
        y((largestSegment.start + largestSegment.end) / 2),
      )}" text-anchor="${labelAnchor}" dominant-baseline="middle" font-size="12" font-weight="700" fill="#0f172a">${escapeHtml(
        largestSegment.label,
      )}</text>`;

      return `${segments}${label}`;
    })
    .join("");

  return renderSvg(`${renderXAxis(groups.map((group) => group.label), x, chartHeight - margin.bottom)}${bars}${renderLegend([...colorByLineId.keys()])}`);
}

function renderWorkingCapitalChart(chart: ChartSpec, options: ChartRenderOptions): string {
  const data = chart.data as Array<{ reportingDate: string; workingCapital: number }>;
  const margin = { top: 28, right: 34, bottom: 64, left: 82 };
  const x = d3
    .scalePoint<string>()
    .domain(data.map((item) => item.reportingDate))
    .range([margin.left, chartWidth - margin.right]);
  const y = d3
    .scaleLinear()
    .domain(buildWorkingCapitalDomain(data.map((item) => item.workingCapital)))
    .range([chartHeight - margin.bottom, margin.top]);
  const points = data.map((item) => ({ x: x(item.reportingDate) ?? margin.left, y: y(item.workingCapital) }));
  const markers = data
    .map(
      (item) =>
        `<circle cx="${round(x(item.reportingDate) ?? 0)}" cy="${round(y(item.workingCapital))}" r="4" fill="${fallbackColor}" stroke="#fff" stroke-width="1.5" />`,
    )
    .join("");

  return renderSvg(
    `${renderYAxis(y, margin, options.amountScale)}${renderXAxis(data.map((item) => item.reportingDate), x, chartHeight - margin.bottom)}<path d="${buildStepPath(
      points,
    )}" fill="none" stroke="${fallbackColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />${markers}`,
  );
}

function renderDiagnosticsSlide(diagnostics: DiagnosticReport): string {
  return `<section data-slide-id="diagnostics">
        <h2>Diagnostics Appendix</h2>
        <div class="report-table-wrap">
          <table class="report-table"><thead><tr><th>Severity</th><th>Code</th><th>Message</th></tr></thead><tbody>${diagnostics.items
            .map(
              (item) =>
                `<tr><td>${escapeHtml(item.severity)}</td><td>${escapeHtml(item.code)}</td><td>${escapeHtml(item.message)}</td></tr>`,
            )
            .join("")}</tbody></table>
        </div>
      </section>`;
}

function renderSvg(content: string): string {
  return `<svg class="chart-svg" viewBox="0 0 ${chartWidth} ${chartHeight}" role="img">${content}</svg>`;
}

function renderYAxis(
  y: d3.ScaleLinear<number, number>,
  margin: { top: number; right: number; bottom: number; left: number },
  amountScale: AmountScale,
): string {
  const axisX = margin.left;
  const axisLine = `<line class="axis-line" x1="${axisX}" x2="${axisX}" y1="${margin.top}" y2="${chartHeight - margin.bottom}" />`;
  const ticks = y
    .ticks(5)
    .map((tick) => {
      const tickY = y(tick);
      return `<g><line class="chart-grid" x1="${axisX}" x2="${chartWidth - margin.right}" y1="${round(tickY)}" y2="${round(
        tickY,
      )}" /><text class="tick-label" x="${axisX - 8}" y="${round(tickY + 4)}" text-anchor="end">${formatAmount(
        tick,
        amountScale,
      )}</text></g>`;
    })
    .join("");

  return `${ticks}${axisLine}`;
}

function renderXAxis(
  labels: string[],
  x: d3.ScalePoint<string> | d3.ScaleBand<string>,
  axisY: number,
): string {
  const axisLine = `<line class="axis-line" x1="${round(Number(x.range()[0] ?? 0))}" x2="${round(
    Number(x.range()[1] ?? chartWidth),
  )}" y1="${axisY}" y2="${axisY}" />`;
  const bandwidth = "bandwidth" in x ? x.bandwidth() : 0;
  const ticks = labels
    .map((label) => {
      const tickX = (x(label) ?? 0) + bandwidth / 2;
      return `<text class="tick-label" x="${round(tickX)}" y="${axisY + 22}" text-anchor="middle">${escapeHtml(label)}</text>`;
    })
    .join("");

  return `${axisLine}${ticks}`;
}

function renderLegend(labels: string[]): string {
  return labels
    .slice(0, 8)
    .map((label, index) => {
      const y = 28 + index * 20;
      return `<g><rect x="${chartWidth - 170}" y="${y}" width="10" height="10" rx="2" fill="${
        palette[index % palette.length] ?? fallbackColor
      }" /><text class="legend-label" x="${chartWidth - 154}" y="${y + 9}">${escapeHtml(label)}</text></g>`;
    })
    .join("");
}

function findLargestStackSegment(
  segments: Array<{ label: string; amount: number }>,
): { label: string; amount: number; start: number; end: number } | null {
  let cumulative = 0;
  let largestSegment: { label: string; amount: number; start: number; end: number } | null = null;

  for (const segment of segments) {
    const start = cumulative;
    const amount = Math.max(0, segment.amount);
    const end = cumulative + amount;
    cumulative = end;

    if (!largestSegment || amount > largestSegment.amount) {
      largestSegment = { label: segment.label, amount, start, end };
    }
  }

  return largestSegment;
}

function buildWorkingCapitalDomain(values: number[]): [number, number] {
  if (values.length === 0) {
    return [0, 1];
  }

  const minValue = d3.min(values) ?? 0;
  const maxValue = d3.max(values) ?? 0;
  const spread = maxValue - minValue;
  const rangeBase = spread > 0 ? spread : Math.max(Math.abs(maxValue), 1);

  return [Math.max(0, minValue - rangeBase * 0.05), maxValue + rangeBase * 0.03];
}

function buildStepPath(points: Array<{ x: number; y: number }>): string {
  const firstPoint = points[0];

  if (!firstPoint) {
    return "";
  }

  return points.slice(1).reduce((path, point) => `${path}H${round(point.x)}V${round(point.y)}`, `M${round(firstPoint.x)},${round(firstPoint.y)}`);
}

function escapeScriptJson(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll(">", "\\u003e").replaceAll("&", "\\u0026");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function formatAmount(value: number, scale: AmountScale): string {
  const divisor = scale === "million" ? 1_000_000 : scale === "thousand" ? 1_000 : 1;
  const suffix = scale === "million" ? "m" : scale === "thousand" ? "k" : "";

  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: scale === "raw" ? 0 : 1,
  }).format(value / divisor)}${suffix}`;
}

function formatSignedAmount(value: number, scale: AmountScale): string {
  if (value === 0) {
    return formatAmount(0, scale);
  }

  return `${value > 0 ? "+" : "-"}${formatAmount(Math.abs(value), scale)}`;
}

function formatPercentMagnitude(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "n/a";
  }

  return `${Math.abs(value * 100).toFixed(1)}%`;
}

function renderKpiIcon(icon: "trend" | "margin" | "income" | "assets" | "cash"): string {
  const common = `viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;

  if (icon === "trend") {
    return `<svg ${common}><path d="M3 17l6-6 4 4 8-8"></path><path d="M14 7h7v7"></path></svg>`;
  }

  if (icon === "margin") {
    return `<svg ${common}><path d="M4 19V5"></path><path d="M4 19h16"></path><path d="M8 15l3-3 3 2 5-7"></path></svg>`;
  }

  if (icon === "income") {
    return `<svg ${common}><circle cx="12" cy="12" r="8"></circle><path d="M12 7v10"></path><path d="M9 10c0-1.7 6-1.7 6 0 0 3-6 1-6 4 0 1.7 6 1.7 6 0"></path></svg>`;
  }

  if (icon === "assets") {
    return `<svg ${common}><path d="M4 20h16"></path><path d="M6 20V8l6-4 6 4v12"></path><path d="M9 20v-6h6v6"></path></svg>`;
  }

  return `<svg ${common}><rect x="4" y="7" width="16" height="11" rx="2"></rect><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"></path><path d="M8 12h8"></path></svg>`;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
