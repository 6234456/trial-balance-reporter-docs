import * as d3 from "d3";

import type { AmountScale, ChartSpec } from "../types";

export type ChartRenderOptions = {
  amountScale: AmountScale;
  plViewMode: "ytd" | "period_activity";
};

const fallbackColor = "#2563eb";
const palette = [fallbackColor, "#0f172a", "#1e40af", "#334155", "#64748b", "#94a3b8"];
const negativeColor = "#334155";

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
  } else if (chart.chartType === "paired-stacked-bar") {
    renderPairedStackedBars(svg, width, height, chart, options, tooltip);
  } else if (chart.chartType === "working-capital") {
    renderWorkingCapital(svg, width, height, chart, options, tooltip);
  }
}

function renderKpis(container: HTMLElement, chart: ChartSpec, options: ChartRenderOptions, tooltip: HTMLDivElement): void {
  const data = chart.data as Record<string, Record<string, number>>;
  const sortedDates = Object.keys(data).sort();
  const latestDate = sortedDates.at(-1);
  const previousDate = sortedDates.at(-2);
  const latest: Record<string, number> = latestDate ? (data[latestDate] ?? {}) : {};
  const previous: Record<string, number> = previousDate ? (data[previousDate] ?? {}) : {};
  const items = [
    { label: "Revenue", key: "revenue", icon: "trend" },
    { label: "Gross profit", key: "grossProfit", icon: "margin" },
    { label: "Net income", key: "netIncome", icon: "income" },
    { label: "Total assets", key: "totalAssets", icon: "assets" },
    { label: "Cash", key: "cash", icon: "cash" },
  ] as const;

  const wrapper = document.createElement("div");
  wrapper.className = "grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(210px,1fr))]";

  for (const item of items) {
    const value = latest[item.key] ?? 0;
    const previousValue = previous[item.key] ?? 0;
    const absoluteChange = value - previousValue;
    const percentChange = previousValue === 0 ? null : absoluteChange / Math.abs(previousValue);
    const movementTone = absoluteChange >= 0 ? "text-blue-700" : "text-slate-700";
    const absoluteChangeText = formatSignedAmount(absoluteChange, options.amountScale);
    const percentChangeText = formatPercentMagnitude(percentChange);
    const card = document.createElement("div");
    card.className =
      "kpi-card min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-md outline-none ring-1 ring-slate-100 transition focus:ring-2 focus:ring-blue-500";
    card.setAttribute("data-change-absolute", absoluteChangeText);
    card.setAttribute("data-change-percent", percentChangeText);
    attachTooltip(
      card,
      tooltip,
      `${item.label}: ${formatAmount(value, options.amountScale)}; vs prior period: ${absoluteChangeText} (${percentChangeText})`,
    );
    card.innerHTML = `
      <div class="flex min-w-0 items-start justify-between gap-2">
        <div class="min-w-0">
          <div class="truncate text-xs font-semibold uppercase tracking-wide text-slate-500">${item.label}</div>
          <div class="mt-2 truncate text-2xl font-semibold text-slate-950">${formatAmount(value, options.amountScale)}</div>
        </div>
        <div class="kpi-icon flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white shadow-sm" aria-hidden="true">
          ${renderKpiIcon(item.icon)}
        </div>
      </div>
      <div class="kpi-change mt-4 flex min-w-0 items-end justify-between gap-2 border-t border-slate-100 pt-3 ${movementTone}">
        <span class="kpi-change-absolute min-w-0 truncate text-xl font-semibold tabular-nums">${absoluteChangeText}</span>
        <span class="kpi-change-percent shrink-0 text-xs font-semibold tabular-nums">${percentChangeText}</span>
      </div>`;
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
    card.className = "rounded-md border border-slate-200 bg-white p-4 shadow-sm outline-none focus:ring-2 focus:ring-blue-500";
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
  type TrendDatum = {
    reportingDate: string;
    series: string;
    ytdAmount: number;
    periodActivityAmount: number;
  };
  const data = chart.data as TrendDatum[];
  const key = options.plViewMode === "period_activity" ? "periodActivityAmount" : "ytdAmount";
  const margin = { top: 20, right: 28, bottom: 44, left: 72 };
  const dates = [...new Set(data.map((item) => item.reportingDate))];
  const series = [...new Set(data.map((item) => item.series))];
  const x = d3.scalePoint(dates, [margin.left, width - margin.right]);
  const extent = d3.extent(data, (item) => item[key]);
  const y = d3
    .scaleLinear()
    .domain([Math.min(0, extent[0] ?? 0), Math.max(0, extent[1] ?? 0)])
    .nice()
    .range([height - margin.bottom, margin.top]);
  const line = d3
    .line<TrendDatum>()
    .curve(d3.curveMonotoneX)
    .x((item) => x(item.reportingDate) ?? 0)
    .y((item) => y(item[key]));

  drawAxes(svg, x, y, width, height, margin, options.amountScale);

  svg
    .append("g")
    .attr("class", "trend-baselines")
    .selectAll("line")
    .data(dates)
    .join("line")
    .attr("class", "trend-baseline")
    .attr("x1", (date) => x(date) ?? 0)
    .attr("x2", (date) => x(date) ?? 0)
    .attr("y1", margin.top)
    .attr("y2", height - margin.bottom)
    .attr("stroke", "#cbd5e1")
    .attr("stroke-width", 1)
    .attr("opacity", 0.75);

  series.forEach((seriesName, seriesIndex) => {
    const seriesData = data.filter((item) => item.series === seriesName);
    const color = palette[seriesIndex % palette.length] ?? fallbackColor;

    svg
      .append("path")
      .datum(seriesData)
      .attr("class", "trend-line-path")
      .attr("fill", "none")
      .attr("stroke", color)
      .attr("stroke-width", 3)
      .attr("stroke-linecap", "round")
      .attr("stroke-linejoin", "round")
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
      .attr("stroke-width", 1.5);
  });

  const hitboxWidth = calculatePointHitboxWidth(dates.map((date) => x(date) ?? 0), margin.left, width - margin.right);
  svg
    .append("g")
    .attr("class", "trend-hitboxes")
    .selectAll("rect")
    .data(dates)
    .join("rect")
    .attr("class", "trend-hitbox")
    .attr("x", (date) => centeredHitboxX(x(date) ?? margin.left, hitboxWidth, margin.left, width - margin.right))
    .attr("y", margin.top)
    .attr("width", hitboxWidth)
    .attr("height", height - margin.top - margin.bottom)
    .attr("fill", "#ffffff")
    .attr("opacity", 0.001)
    .each(function addTooltip(date) {
      if (this instanceof Element) {
        attachTooltip(this, tooltip, buildTrendTooltip(date, series, data, key, options.amountScale));
      }
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

function renderPairedStackedBars(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  width: number,
  height: number,
  chart: ChartSpec,
  options: ChartRenderOptions,
  tooltip: HTMLDivElement,
): void {
  const dataByPeriod = chart.data as Record<
    string,
    Array<{
      group: string;
      label: string;
      segments: Array<{ lineId: string; label: string; amount: number }>;
    }>
  >;
  const latestDate = Object.keys(dataByPeriod).sort().at(-1) ?? "";
  const groups = dataByPeriod[latestDate] ?? [];
  const margin = { top: 24, right: 190, bottom: 48, left: 72 };
  const totals = groups.map((group) => d3.sum(group.segments, (segment) => Math.max(0, segment.amount)));
  const x = d3
    .scaleBand()
    .domain(groups.map((group) => group.label))
    .range([margin.left, width - margin.right])
    .padding(0.42);
  const y = d3
    .scaleLinear()
    .domain([0, d3.max(totals) ?? 0])
    .nice()
    .range([height - margin.bottom, margin.top]);
  const colorByLineId = new Map<string, string>();

  chart.sourceLineIds.forEach((lineId, index) => {
    colorByLineId.set(lineId, palette[index % palette.length] ?? fallbackColor);
  });

  drawAxes(svg, x, y, width, height, margin, options.amountScale);

  const groupLayer = svg.append("g");

  groups.forEach((group, groupIndex) => {
    const xPosition = x(group.label) ?? margin.left;
    let cumulative = 0;
    const largestSegment = findLargestStackSegment(group.segments);

    group.segments.forEach((segment) => {
      const start = cumulative;
      const amount = Math.max(0, segment.amount);
      const end = cumulative + amount;
      cumulative = end;

      groupLayer
        .append("rect")
        .attr("x", xPosition)
        .attr("y", y(end))
        .attr("width", x.bandwidth())
        .attr("height", Math.max(1, y(start) - y(end)))
        .attr("rx", 4)
        .attr("fill", colorByLineId.get(segment.lineId) ?? fallbackColor)
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 1)
        .each(function addTooltip() {
          if (this instanceof Element) {
            attachTooltip(
              this,
              tooltip,
              `${group.label} / ${segment.label}: ${formatAmount(segment.amount, options.amountScale)}`,
            );
          }
        });
    });

    if (largestSegment && largestSegment.amount > 0) {
      const horizontalBias = groupIndex === 0 ? "left" : "right";
      const labelXOffset = x.bandwidth() * (horizontalBias === "left" ? -0.14 : 0.14);

      svg
        .append("text")
        .attr("class", "paired-largest-segment-label")
        .attr("data-group", group.group)
        .attr("data-horizontal-bias", horizontalBias)
        .attr("x", xPosition + x.bandwidth() / 2 + labelXOffset)
        .attr("y", y((largestSegment.start + largestSegment.end) / 2))
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("font-size", 11)
        .attr("font-weight", 700)
        .attr("fill", "#ffffff")
        .attr("stroke", "#0f172a")
        .attr("stroke-width", 2.5)
        .attr("paint-order", "stroke")
        .attr("pointer-events", "none")
        .text(largestSegment.label);
    }

    svg
      .append("text")
      .attr("x", xPosition + x.bandwidth() / 2)
      .attr("y", y(cumulative) - 8)
      .attr("text-anchor", "middle")
      .attr("font-size", 12)
      .attr("font-weight", 700)
      .attr("fill", "#0f172a")
      .text(formatAmount(cumulative, options.amountScale));
  });

  const legend = svg.append("g").attr("transform", `translate(${width - margin.right + 18},${margin.top})`);
  chart.sourceLineIds.forEach((lineId, index) => {
    const segment = groups.flatMap((group) => group.segments).find((candidate) => candidate.lineId === lineId);
    const yPosition = index * 18;

    legend
      .append("rect")
      .attr("x", 0)
      .attr("y", yPosition)
      .attr("width", 10)
      .attr("height", 10)
      .attr("rx", 2)
      .attr("fill", colorByLineId.get(lineId) ?? fallbackColor);
    legend
      .append("text")
      .attr("x", 16)
      .attr("y", yPosition + 9)
      .attr("font-size", 10)
      .attr("fill", "#475569")
      .text(segment?.label ?? lineId);
  });
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

function renderWorkingCapital(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  width: number,
  height: number,
  chart: ChartSpec,
  options: ChartRenderOptions,
  tooltip: HTMLDivElement,
): void {
  const data = (chart.data as Array<{ reportingDate: string; workingCapital: number }>).map((item) => ({
    label: item.reportingDate,
    reportingDate: item.reportingDate,
    amount: item.workingCapital,
  }));
  const margin = { top: 20, right: 24, bottom: 56, left: 72 };
  const x = d3
    .scalePoint()
    .domain(data.map((item) => item.label))
    .range([margin.left, width - margin.right]);
  const y = d3
    .scaleLinear()
    .domain(buildWorkingCapitalDomain(data.map((item) => item.amount)))
    .range([height - margin.bottom, margin.top]);
  const points = data.map((item) => ({ x: x(item.label) ?? margin.left, y: y(item.amount) }));

  drawAxes(svg, x, y, width, height, margin, options.amountScale);

  svg
    .append("path")
    .datum(points)
    .attr("class", "working-capital-line")
    .attr("fill", "none")
    .attr("stroke", fallbackColor)
    .attr("stroke-width", 3)
    .attr("stroke-linecap", "round")
    .attr("stroke-linejoin", "round")
    .attr("d", buildStepPath(points));

  svg
    .selectAll("circle.working-capital-marker")
    .data(data)
    .join("circle")
    .attr("class", "working-capital-marker")
    .attr("cx", (item) => x(item.label) ?? margin.left)
    .attr("cy", (item) => y(item.amount))
    .attr("r", 4)
    .attr("fill", fallbackColor)
    .attr("stroke", "#ffffff")
    .attr("stroke-width", 1.5);

  const hitboxWidth = calculatePointHitboxWidth(points.map((point) => point.x), margin.left, width - margin.right);
  svg
    .append("g")
    .attr("class", "working-capital-hitboxes")
    .selectAll("rect")
    .data(data)
    .join("rect")
    .attr("class", "working-capital-hitbox")
    .attr("x", (item) => centeredHitboxX(x(item.label) ?? margin.left, hitboxWidth, margin.left, width - margin.right))
    .attr("y", margin.top)
    .attr("width", hitboxWidth)
    .attr("height", height - margin.top - margin.bottom)
    .attr("fill", "#ffffff")
    .attr("opacity", 0.001)
    .each(function addTooltip(item) {
      if (this instanceof Element) {
        attachTooltip(this, tooltip, `${item.reportingDate}: ${formatAmount(item.amount, options.amountScale)}`);
      }
    });
}

function buildTrendTooltip(
  date: string,
  seriesNames: string[],
  data: Array<{ reportingDate: string; series: string; ytdAmount: number; periodActivityAmount: number }>,
  key: "ytdAmount" | "periodActivityAmount",
  amountScale: AmountScale,
): string {
  const rows = seriesNames.map((seriesName) => {
    const item = data.find((candidate) => candidate.reportingDate === date && candidate.series === seriesName);
    return `${seriesName}: ${formatAmount(item?.[key] ?? 0, amountScale)}`;
  });

  return [date, ...rows].join("\n");
}

function calculatePointHitboxWidth(points: number[], minX: number, maxX: number): number {
  if (points.length <= 1) {
    return Math.max(48, maxX - minX);
  }

  const distances = points.slice(1).map((point, index) => Math.abs(point - (points[index] ?? point)));
  return Math.max(48, d3.min(distances) ?? 48);
}

function centeredHitboxX(center: number, width: number, minX: number, maxX: number): number {
  return Math.max(minX, Math.min(center - width / 2, maxX - width));
}

function buildWorkingCapitalDomain(values: number[]): [number, number] {
  if (values.length === 0) {
    return [0, 1];
  }

  const minValue = d3.min(values) ?? 0;
  const maxValue = d3.max(values) ?? 0;
  const spread = maxValue - minValue;
  const rangeBase = spread > 0 ? spread : Math.max(Math.abs(maxValue), 1);
  const lowerBound = Math.max(0, minValue - rangeBase * 0.05);
  const upperBound = maxValue + rangeBase * 0.03;

  return [lowerBound, upperBound];
}

function buildStepPath(points: Array<{ x: number; y: number }>): string {
  const firstPoint = points[0];

  if (!firstPoint) {
    return "";
  }

  return points.slice(1).reduce((path, point) => `${path}H${point.x}V${point.y}`, `M${firstPoint.x},${firstPoint.y}`);
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
    .attr("fill", (item, index) => (item.amount < 0 ? negativeColor : (palette[index % palette.length] ?? fallbackColor)))
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
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).tickSizeOuter(0))
    .call((group) => group.selectAll("text").attr("font-size", 11));

  svg
    .append("g")
    .attr("class", "y-axis")
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

  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
    style: "percent",
  }).format(Math.abs(value));

  return formatted;
}

function cssClass(value: string): string {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
}

function renderKpiIcon(icon: "trend" | "margin" | "income" | "assets" | "cash"): string {
  const common = `class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;

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
