# ChartDataModel

ChartDataModel is generated from StatementModel and drives both SPA chart preview and exported Reveal.js charts.

```ts
type ChartDataModel = {
  schemaVersion: "1.0";
  charts: ChartSpec[];
};
```

## Chart Set

The standard finance pack SHOULD include:

1. KPI cards
2. Revenue / gross profit / net income trend
3. P&L waterfall
4. Assets vs liabilities and equity composition as two parallel vertical stacked bars
5. Working capital chart
6. Diagnostics summary

## D3 Rendering Rules

- D3 renderers MUST directly render SVG into a provided container.
- React MUST only provide containers.
- The same renderers MUST be reusable inside exported Reveal HTML.
- Chart renderers MUST be idempotent.
