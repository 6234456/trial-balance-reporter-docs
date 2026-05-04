# Architecture

## Runtime Architecture

The MVP is a pure browser SPA. It has no backend and no runtime server.

```text
Excel Workbook
  ├─ TB sheet
  └─ Mapping sheet
        ↓
Browser File API
        ↓
SheetJS workbook reader
        ↓
TB / Mapping parsers
        ↓
Validation diagnostics
        ↓
Mapping engine
        ↓
Statement engine
        ↓
ChartDataModel builder
        ↓
React preview + D3 renderers
        ↓
SlideModel + ThemePreset
        ↓
Self-contained Reveal.js HTML export
```

## Layers

| Layer | Responsibility |
|---|---|
| `excel/` | Workbook reading and sheet parsing. |
| `domain/` | Pure calculation: mapping, statement, diagnostics, formulas. |
| `chart/` | ChartDataModel and reusable D3 renderers. |
| `reveal/` | SlideModel and self-contained HTML generation. |
| `theme/` | Theme tokens, CSS variables, chart/table/animation presets. |
| `components/` | React UI components. |
| `state/` | AppState, reducer/actions, LocalStorage preferences. |
