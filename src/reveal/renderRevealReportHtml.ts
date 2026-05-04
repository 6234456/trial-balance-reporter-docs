import type { ChartDataModel, DiagnosticReport, ReportConfig, StatementModel } from "../types";

type RenderInput = {
  statement: StatementModel;
  chartData: ChartDataModel;
  diagnostics: DiagnosticReport;
  config: ReportConfig;
};

export function renderRevealReportHtml(input: RenderInput): string {
  const payload = escapeScriptJson({
    config: input.config,
    statement: input.statement,
    chartData: input.chartData,
    diagnostics: input.diagnostics,
  });
  const latestPeriod = input.statement.periods.at(-1)?.reportingDate ?? "";
  const netIncome =
    input.statement.statements.profitOrLoss.linesById.PL_NET_INCOME?.amountsByPeriod[latestPeriod]?.presentationAmount ?? 0;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(input.config.title)}</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8fafc; color: #0f172a; }
    body { margin: 0; background: #f8fafc; }
    .reveal { min-height: 100vh; display: grid; grid-template-rows: 1fr auto; }
    .slides { min-height: calc(100vh - 64px); display: grid; }
    section { display: none; padding: 56px; box-sizing: border-box; }
    section.active { display: grid; align-content: center; gap: 24px; }
    h1, h2 { margin: 0; line-height: 1.05; letter-spacing: 0; }
    h1 { font-size: clamp(40px, 7vw, 84px); max-width: 900px; }
    h2 { font-size: clamp(30px, 5vw, 56px); }
    p { margin: 0; color: #475569; font-size: 18px; line-height: 1.7; }
    table { border-collapse: collapse; width: 100%; background: white; border: 1px solid #e2e8f0; }
    th, td { padding: 12px 14px; border-bottom: 1px solid #e2e8f0; text-align: right; }
    th:first-child, td:first-child { text-align: left; }
    .kpis { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
    .card { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; }
    .label { text-transform: uppercase; font-size: 12px; font-weight: 700; color: #64748b; }
    .value { margin-top: 8px; font-size: 32px; font-weight: 700; }
    .chart { min-height: 340px; background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; }
    .controls { display: flex; align-items: center; justify-content: space-between; gap: 12px; border-top: 1px solid #e2e8f0; padding: 14px 18px; background: white; }
    button, select { min-height: 40px; border: 1px solid #cbd5e1; border-radius: 6px; background: white; padding: 0 12px; font: inherit; }
    @media print { .controls { display: none; } section { display: block; break-after: page; min-height: 100vh; } }
  </style>
</head>
<body>
  <div class="reveal">
    <div class="slides">
      <section class="active">
        <h1>${escapeHtml(input.config.title)}</h1>
        <p>${escapeHtml(input.config.companyName)} · ${escapeHtml(input.config.reportPeriodLabel)} · ${escapeHtml(latestPeriod)}</p>
      </section>
      <section>
        <h2>Executive KPIs</h2>
        <div class="kpis">
          <div class="card"><div class="label">Net income</div><div class="value">${formatAmount(netIncome)}</div></div>
          <div class="card"><div class="label">Currency</div><div class="value">${escapeHtml(input.statement.currency)}</div></div>
          <div class="card"><div class="label">Warnings</div><div class="value">${input.diagnostics.summary.warning}</div></div>
        </div>
      </section>
      <section>
        <h2>Financial Statement Preview</h2>
        ${renderStatementTable(input.statement)}
      </section>
      <section>
        <h2>Chart Preview</h2>
        <div id="chart-host" class="chart"></div>
      </section>
      <section>
        <h2>Diagnostics Appendix</h2>
        ${renderDiagnostics(input.diagnostics)}
      </section>
    </div>
    <div class="controls">
      <button type="button" data-prev>Previous</button>
      <span data-progress>1 / 5</span>
      <label>Amount scale <select data-scale><option value="raw">Raw</option><option value="thousand" selected>Thousand</option><option value="million">Million</option></select></label>
      <button type="button" data-next>Next</button>
    </div>
  </div>
  <script>
    window.__REPORT_DATA__ = ${payload};
    function formatNumber(value, scale) {
      var divisor = scale === "million" ? 1000000 : scale === "thousand" ? 1000 : 1;
      var suffix = scale === "million" ? "m" : scale === "thousand" ? "k" : "";
      return new Intl.NumberFormat("en-US", { maximumFractionDigits: scale === "raw" ? 0 : 1 }).format(value / divisor) + suffix;
    }
    function renderChart() {
      var host = document.getElementById("chart-host");
      if (!host) return;
      var scale = document.querySelector("[data-scale]").value;
      var chart = window.__REPORT_DATA__.chartData.charts.find(function(item) { return item.chartId === "pl-trend"; });
      host.innerHTML = "";
      var data = chart.data.filter(function(item) { return item.series === "Net Income"; });
      var max = Math.max.apply(null, data.map(function(item) { return item.ytdAmount; }).concat([1]));
      data.forEach(function(item) {
        var row = document.createElement("div");
        row.style.display = "grid";
        row.style.gridTemplateColumns = "100px 1fr 90px";
        row.style.gap = "12px";
        row.style.alignItems = "center";
        row.style.margin = "12px 0";
        row.innerHTML = "<strong>" + item.reportingDate + "</strong><div style='height:18px;background:#e2e8f0;border-radius:4px;overflow:hidden'><div style='width:" + Math.max(2, item.ytdAmount / max * 100) + "%;height:100%;background:#0f766e'></div></div><span>" + formatNumber(item.ytdAmount, scale) + "</span>";
        host.appendChild(row);
      });
    }
    var Reveal = {
      index: 0,
      initialize: function() {
        var sections = Array.prototype.slice.call(document.querySelectorAll("section"));
        var progress = document.querySelector("[data-progress]");
        function show(index) {
          Reveal.index = Math.max(0, Math.min(index, sections.length - 1));
          sections.forEach(function(section, sectionIndex) { section.classList.toggle("active", sectionIndex === Reveal.index); });
          progress.textContent = (Reveal.index + 1) + " / " + sections.length;
          renderChart();
        }
        document.querySelector("[data-prev]").addEventListener("click", function() { show(Reveal.index - 1); });
        document.querySelector("[data-next]").addEventListener("click", function() { show(Reveal.index + 1); });
        document.querySelector("[data-scale]").addEventListener("change", renderChart);
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

function renderStatementTable(statement: StatementModel): string {
  const latestPeriod = statement.periods.at(-1)?.reportingDate ?? "";
  const rows = [
    ...statement.statements.balanceSheet.lines.filter((line) => line.parentLineId || line.lineType === "header"),
    ...statement.statements.profitOrLoss.lines,
  ];

  return `<table><thead><tr><th>Line</th><th>${escapeHtml(latestPeriod)}</th></tr></thead><tbody>${rows
    .map(
      (line) =>
        `<tr><td>${escapeHtml(line.label.en)}</td><td>${formatAmount(
          line.amountsByPeriod[latestPeriod]?.presentationAmount ?? 0,
        )}</td></tr>`,
    )
    .join("")}</tbody></table>`;
}

function renderDiagnostics(diagnostics: DiagnosticReport): string {
  return `<table><thead><tr><th>Severity</th><th>Code</th><th>Message</th></tr></thead><tbody>${diagnostics.items
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.severity)}</td><td>${escapeHtml(item.code)}</td><td>${escapeHtml(item.message)}</td></tr>`,
    )
    .join("")}</tbody></table>`;
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

function formatAmount(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}
