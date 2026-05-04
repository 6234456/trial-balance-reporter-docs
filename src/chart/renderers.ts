import * as d3 from "d3";

import type { AmountScale, ChartSpec } from "../types";

export type ChartRenderOptions = {
  amountScale: AmountScale;
  plViewMode: "ytd" | "period_activity";
};

const palette = ["#0f766e", "#6d5bd0", "#f59e0b", "#e11d48", "#2563eb", "#14b8a6"];

export function renderChart(container: HTMLElement, chart: ChartSpec, options: ChartRenderOptions): void {
  container.replaceChildren();
  const tooltip = createTooltip(container);

  if (chart.chartType === "kpi-cards") {
    renderKpis(container, chart, options, tooltip);
    return;
  }

  if (chart.chartType === "diagnostics-summary") {
    renderDiagnostics(container, chart, tooltip);
    return;
  }

  const width = Math.max(container.clientWidth, 520);
  const height = 300;
  const svg = d3
    .select(container)
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img")
    .attr("aria-label", chart.title.en)
    .attr("class", "h-full w-full overflow-visible");

  if (chart.chartType === "trend-line") {
    renderTrend(svg, width, height, chart, options, tooltip);
  } else if (chart.chartType === "waterfall") {
    renderWaterfall(svg, width, height, chart, options, tooltip);
  } else if (chart.chartType === "composition") {
    renderComposition(svg, width, height, chart, options, tooltip);
  } else if (chart.chartType === "working-capital") {
    renderWorkingCapital(svg, width, height, chart, options, tooltip);
  }
}

function renderKpis(container: HTMLElement, chart: ChartSpec, options: ChartRenderOptions, tooltip: HTMLDivElement): void {
  const data = chart.data as Record<string, Record<string, number>>;
  const latestDate = Object.keys(data).sort().at(-1);
  const latest: Record<string, number> = latestDate ? (data[latestDate] ?? {}) : {};
  const items = [
    ["Revenue", latest.revenue ?? 0],
    ["Gross profit", latest.grossProfit ?? 0],
    ["Net income", latest.netIncome ?? 0],
    ["Total assets", latest.totalAssets ?? 0],
    ["Cash", latest.cash ?? 0],
  ] as const;

  const wrapper = document.createElement("div");
  wrapper.className = "grid gap-3 sm:grid-cols-2 xl:grid-cols-5";

  for (const [label, value] of items) {
    const card = document.createElement("div");
    card.className = "rounded-md border border-slate-200 bg-white p-4 shadow-sm outline-none focus:ring-2 focus:ring-teal-500";
    attachTooltip(card, tooltip, `${label}: ${formatAmount(value, options.amountScale)}`);
    card.innerHTML = `<div class="text-xs font-semibold uppercase tracking-wide text-slate-500">${label}</div><div class="mt-2 text-2xl font-semibold text-slate-950">${formatAmount(value, options.amountScale)}</div>`;
    wrapper.append(card);
  }

  container.append(wrapper);
}

function renderDiagnostics(container: HTMLElement, chart: ChartSpec, tooltip: HTMLDivElement): void {
  const data = chart.data as Record<string, number>;
  const wrapper = document.createElement("div");
  wrapper.className = "grid gap-3 sm:grid-cols-3";

  for (const key of ["blocking", "warning", "info"]) {
    const card = document.createElement("div");
    card.className = "rounded-md border border-slate-200 bg-white p-4 shadow-sm outline-none focus:ring-2 focus:ring-teal-500";
    attachTooltip(card, tooltip, `${key}: ${data[key] ?? 0}`);
    card.innerHTML = `<div class="text-xs font-semibold uppercase tracking-wide text-slate-500">${key}</div><div class="mt-2 text-3xl font-semibold text-slate-950">${data[key] ?? 0}</div>`;
    wrapper.append(card);
  }

  container.append(wrapper);
}

function renderTrend(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  width: number,
  height: number,
  chart: ChartSpec,
  options: ChartRenderOptions,
  tooltip: HTMLDivElement,
): void {
  const data = chart.data as Array<{
    reportingDate: string;
    series: string;
    ytdAmount: number;
    periodActivityAmount: number;
  }>;
  const key = options.plViewMode === "period_activity" ? "periodActivityAmount" : "ytdAmount";
  const margin = { top: 20, right: 28, bottom: 44, left: 72 };
  const dates = [...new Set(data.map((item) => item.reportingDate))];
  const series = [...new Set(data.map((item) => item.series))];
  const x = d3.scalePoint(dates, [margin.left, width - margin.right]);
  const y = d3
    .scaleLinear()
    .domain([0, d3.max(data, (item) => item[key]) ?? 0])
    .nice()
    .range([height - margin.bottom, margin.top]);
  const line = d3
    .line<(typeof data)[number]>()
    .x((item) => x(item.reportingDate) ?? 0)
    .y((item) => y(item[key]));

  drawAxes(svg, x, y, width, height, margin, options.amountScale);

  series.forEach((seriesName, seriesIndex) => {
    const seriesData = data.filter((item) => item.series === seriesName);
    const color = palette[seriesIndex % palette.length] ?? "#0f766e";

    svg
      .append("path")
      .datum(seriesData)
      .attr("fill", "none")
      .attr("stroke", color)
      .attr("stroke-width", 3)
      .attr("d", line);

    svg
      .selectAll(`circle.${cssClass(seriesName)}`)
      .data(seriesData)
      .join("circle")
      .attr("class", cssClass(seriesName))
      .attr("cx", (item) => x(item.reportingDate) ?? 0)
      .attr("cy", (item) => y(item[key]))
      .attr("r", 4)
      .attr("fill", color)
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 1.5)
      .each(function addTooltip(item) {
        if (this instanceof Element) {
          attachTooltip(this, tooltip, `${item.series} ${item.reportingDate}: ${formatAmount(item[key], options.amountScale)}`);
        }
      });
  });
}

function renderWaterfall(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  width: number,
  height: number,
  chart: ChartSpec,
  options: ChartRenderOptions,
  tooltip: HTMLDivElement,
): void {
  const dataByPeriod = chart.data as Record<string, Array<{ label: string; amount: number; isTotal?: boolean }>>;
  const latestDate = Object.keys(dataByPeriod).sort().at(-1) ?? "";
  const data = dataByPeriod[latestDate] ?? [];
  renderBars(svg, width, height, data.map((item) => ({ label: item.label, amount: item.amount })), options.amountScale, tooltip);
}

function renderComposition(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  width: number,
  height: number,
  chart: ChartSpec,
  options: ChartRenderOptions,
  tooltip: HTMLDivElement,
): void {
  const dataByPeriod = chart.data as Record<string, Array<{ label: string; amount: number }>>;
  const latestDate = Object.keys(dataByPeriod).sort().at(-1) ?? "";
  renderBars(svg, width, height, dataByPeriod[latestDate] ?? [], options.amountScale, tooltip);
}

function renderWorkingCapital(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  width: number,
  height: number,
  chart: ChartSpec,
  options: ChartRenderOptions,
  tooltip: HTMLDivElement,
): void {
  const data = chart.data as Array<{ reportingDate: string; workingCapital: number }>;
  renderBars(
    svg,
    width,
    height,
    data.map((item) => ({ label: item.reportingDate.slice(5), amount: item.workingCapital })),
    options.amountScale,
    tooltip,
  );
}

function renderBars(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  width: number,
  height: number,
  data: Array<{ label: string; amount: number }>,
  amountScale: AmountScale,
  tooltip: HTMLDivElement,
): void {
  const margin = { top: 20, right: 24, bottom: 56, left: 72 };
  const x = d3
    .scaleBand()
    .domain(data.map((item) => item.label))
    .range([margin.left, width - margin.right])
    .padding(0.28);
  const extent = d3.extent(data, (item) => item.amount);
  const y = d3
    .scaleLinear()
    .domain([Math.min(0, extent[0] ?? 0), Math.max(0, extent[1] ?? 0)])
    .nice()
    .range([height - margin.bottom, margin.top]);

  drawAxes(svg, x, y, width, height, margin, amountScale);

  svg
    .selectAll("rect")
    .data(data)
    .join("rect")
    .attr("x", (item) => x(item.label) ?? 0)
    .attr("y", (item) => y(Math.max(0, item.amount)))
    .attr("width", x.bandwidth())
    .attr("height", (item) => Math.abs(y(item.amount) - y(0)))
    .attr("rx", 4)
    .attr("fill", (item, index) => (item.amount < 0 ? "#e11d48" : (palette[index % palette.length] ?? "#0f766e")))
    .each(function addTooltip(item) {
      if (this instanceof Element) {
        attachTooltip(this, tooltip, `${item.label}: ${formatAmount(item.amount, amountScale)}`);
      }
    });
}

function drawAxes(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  x: d3.AxisScale<string>,
  y: d3.ScaleLinear<number, number>,
  width: number,
  height: number,
  margin: { top: number; right: number; bottom: number; left: number },
  amountScale: AmountScale,
): void {
  svg
    .append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).tickSizeOuter(0))
    .call((group) => group.selectAll("text").attr("font-size", 11));

  svg
    .append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(5).tickFormat((value) => formatAmount(Number(value), amountScale)))
    .call((group) => group.selectAll("text").attr("font-size", 11))
    .call((group) => group.select(".domain").remove());

  svg
    .append("line")
    .attr("x1", margin.left)
    .attr("x2", width - margin.right)
    .attr("y1", y(0))
    .attr("y2", y(0))
    .attr("stroke", "#cbd5e1");
}

export function formatAmount(value: number, scale: AmountScale): string {
  const divisor = scale === "million" ? 1_000_000 : scale === "thousand" ? 1_000 : 1;
  const suffix = scale === "million" ? "m" : scale === "thousand" ? "k" : "";
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: scale === "raw" ? 0 : 1,
  }).format(value / divisor)}${suffix}`;
}

function cssClass(value: string): string {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
}

function createTooltip(container: HTMLElement): HTMLDivElement {
  container.style.position = "relative";

  const tooltip = document.createElement("div");
  tooltip.className = "chart-tooltip";
  tooltip.setAttribute("role", "tooltip");
  tooltip.hidden = true;
  container.append(tooltip);

  return tooltip;
}

function attachTooltip(target: Element, tooltip: HTMLDivElement, text: string): void {
  target.setAttribute("data-tooltip", text);
  target.setAttribute("tabindex", "0");

  const show = (event?: Event) => {
    tooltip.textContent = text;
    tooltip.hidden = false;
    positionTooltip(target, tooltip, event);
  };
  const hide = () => {
    tooltip.hidden = true;
  };

  target.addEventListener("pointerenter", show);
  target.addEventListener("pointermove", show);
  target.addEventListener("pointerleave", hide);
  target.addEventListener("focus", show);
  target.addEventListener("blur", hide);
}

function positionTooltip(target: Element, tooltip: HTMLDivElement, event?: Event): void {
  const container = tooltip.parentElement;

  if (!container) {
    return;
  }

  const containerRect = container.getBoundingClientRect();

  if (typeof PointerEvent !== "undefined" && event instanceof PointerEvent) {
    tooltip.style.left = `${event.clientX - containerRect.left + 12}px`;
    tooltip.style.top = `${event.clientY - containerRect.top + 12}px`;
    return;
  }

  const targetRect = target.getBoundingClientRect();
  tooltip.style.left = `${Math.max(8, targetRect.left - containerRect.left)}px`;
  tooltip.style.top = `${Math.max(8, targetRect.top - containerRect.top - 34)}px`;
}
