# trial-balance-reporter — Codex Development Plan

> Audience: human maintainer + Codex.  
> Language: English primary, with Chinese explanatory notes where useful.  
> Version: draft v0.1 planning package.  
> Current date: 2026-05-04.

## 1. Product Definition

`trial-balance-reporter` is a browser-only React + Vite application. It reads a single Excel workbook containing two sheets, `TB` and `Mapping`, transforms trial balance data into financial statements, validates mapping and balance integrity, previews financial statements and D3 charts, and exports a self-contained interactive Reveal.js HTML report.

中文说明：这是一个纯浏览器端财务报表生成工具。用户上传包含 `TB` 与 `Mapping` 两张表的 Excel 文件后，程序在本地完成解析、映射、校验、报表生成、图表预览，并导出可离线打开的交互式 Reveal.js HTML 报告。

## 2. Global MUST / MUST NOT Rules

### MUST

- MUST run entirely in the browser at runtime.
- MUST process Excel files locally; no file upload to any server.
- MUST use React + Vite + TypeScript + Tailwind.
- MUST use SheetJS / `xlsx` for browser-side Excel parsing.
- MUST use D3 for chart rendering and animation.
- MUST use Decimal-style arithmetic for financial amounts; JavaScript `number` may be used only at display boundaries.
- MUST keep core domain functions pure and independent from React / DOM.
- MUST preserve account-level mapping trace.
- MUST support wide-format TB with date columns.
- MUST use `#`-prefixed metadata columns.
- MUST treat TB accounting sign as: positive = debit, negative = credit.
- MUST treat P&L input amounts as YTD amounts.
- MUST export a self-contained interactive Reveal.js HTML file.
- MUST include validation diagnostics in SPA and exported report appendix.
- MUST include fixture-based tests.

### MUST NOT

- MUST NOT add backend APIs, server runtimes, databases, authentication, or cloud storage.
- MUST NOT upload Excel content anywhere.
- MUST NOT store raw financial data in LocalStorage.
- MUST NOT introduce UI component libraries; use Tailwind and project-local components only.
- MUST NOT use `eval` or dynamic JavaScript execution for formulas.
- MUST NOT silently ignore unmapped non-zero accounts.
- MUST NOT automatically plug balance differences.
- MUST NOT make domain code depend on React, DOM, browser storage, or D3.
- MUST NOT create a separate D3 implementation for SPA and Reveal; renderers must be reusable.

## 3. Repository Structure

```text
trial-balance-reporter/
├─ plan.md
├─ README.md
├─ LICENSE
├─ docs/
├─ docs/adr/
├─ fixtures/csv/
├─ scripts/
├─ test/fixtures/
├─ public/examples/
├─ src/
└─ .github/workflows/
```

## 4. Milestones

### Milestone 0 — Project Scaffold

#### Goal

Create the complete React + Vite + TypeScript + Tailwind project scaffold.

#### Scope

- `pnpm`
- React + Vite
- TypeScript strict mode
- Tailwind
- Vitest
- ESLint + Prettier
- GitHub Actions CI
- GitHub Pages deploy workflow
- README skeleton
- docs skeleton
- MIT license

#### Non-goals

- No Excel parser yet.
- No domain engine yet.
- No D3 chart yet.
- No Reveal export yet.

#### Acceptance Criteria

- `pnpm install` works.
- `pnpm dev` starts the SPA.
- `pnpm test` runs Vitest.
- `pnpm build` produces a static build.
- CI runs lint, typecheck, test, and build.

#### Codex Prompt Block

```text
Implement Milestone 0 for trial-balance-reporter.

Use React + Vite + TypeScript + Tailwind + Vitest + ESLint + Prettier + pnpm.
Do not add backend code. Do not add a UI component library.
Create the project scaffold, package config, tsconfig, vite config, Tailwind config,
README skeleton, docs skeleton, MIT LICENSE, and GitHub Actions workflows.

The app should show a minimal placeholder page with project name and links to load demo / upload Excel placeholders.
```

### Milestone 1 — Excel Schema + Fixture Generator + Parser

#### Goal

Implement Excel schema documentation, fixture generation, SheetJS workbook reader, TB parser, Mapping parser, and diagnostics.

#### Scope

- `docs/excel-schema.md`
- `scripts/generate-fixtures.ts`
- `public/examples/sample-valid.xlsx`
- `public/examples/sample-with-warnings.xlsx`
- SheetJS workbook reader
- TB wide-format parser
- Mapping parser
- Column classification
- Date column validation
- Diagnostics model
- Parser unit tests

#### Non-goals

- No financial statement engine.
- No D3 charts.
- No Reveal export.

#### Acceptance Criteria

- `sample-valid.xlsx` parses without blocking diagnostics.
- `TB` and `Mapping` sheets are mandatory.
- `#` metadata columns are correctly identified.
- ISO date amount columns are correctly identified and sorted.
- Parser preserves original column order for trace.
- Parser produces diagnostics for blank values, duplicate accounts, invalid dates, and missing required fields.

#### Codex Prompt Block

```text
Implement Milestone 1.

Create the Excel schema documentation and fixture generator.
Implement SheetJS workbook reading and parsers for TB and Mapping sheets.

TB is wide format:
- metadata columns start with "#"
- date amount columns do not start with "#"
- date columns must be ISO YYYY-MM-DD
- amount sign: debit positive, credit negative
- P&L columns are YTD

Mapping defines statement lines, account matching, signs, formulas, and chart roles.

Do not implement statement calculations yet.
Add Vitest tests using CSV/fixture data.
```

### Milestone 2 — Domain Engine

#### Goal

Implement mapping, formula parsing, statement tree construction, multi-period views, checks, and expected JSON tests.

#### Scope

- Account normalization
- Range / prefix matching
- Specificity ranking: exact > range > prefix
- Conflict diagnostics
- Duplicate account aggregation with trace
- PL YTD view
- PL period activity derived view
- BS ending balance view
- BS movement view
- Statement tree construction
- Formula tokenizer
- Synthetic current result bridge
- TB signed sum check
- FS balance check
- Expected JSON tests

#### Non-goals

- No React wizard.
- No D3 chart rendering.
- No Reveal export.

#### Acceptance Criteria

- `sample-valid` StatementModel matches `test/fixtures/expected-valid-statement-model.json`.
- `sample-with-warnings` produces expected warnings.
- No use of `eval`.
- Domain functions are pure and DOM-independent.

#### Codex Prompt Block

```text
Implement Milestone 2.

Build the domain engine from parsed TB and Mapping rows.
Use pure TypeScript functions. Do not depend on React, DOM, LocalStorage, or D3.

Implement:
- account matching cache by account_code
- exact/range/prefix matching
- conflict diagnostics
- statement line aggregation
- formula tokenizer for LINE_ID + LINE_ID - LINE_ID only
- synthetic line support with include_in_parent_total
- PL YTD and period activity views
- BS ending balance and movement views
- TB and FS balance checks

Write fixture-based tests against expected JSON.
```

### Milestone 3 — React Wizard + FS Preview

#### Goal

Implement the first user-facing MVP: upload, validate, configure, and preview FS tables.

#### Scope

- Step wizard: Upload → Validate → Configure → Preview → Export placeholder
- File upload
- Load demo
- Download sample fixture buttons
- Validation panel
- ReportConfig form
- LocalStorage preferences
- BS / PL table preview
- Diagnostics display

#### Non-goals

- No D3 chart rendering yet.
- No Reveal export yet.

#### Acceptance Criteria

- User can upload Excel.
- User can load demo fixture.
- User sees grouped diagnostics: blocking / warning / info.
- User can configure report title, company name, period label, language, amount scale, and PL view mode.
- User can preview BS and P&L.

#### Codex Prompt Block

```text
Implement Milestone 3.

Create a React wizard using Tailwind and project-local components only.
Use useReducer or equivalent React state; do not introduce Redux/Zustand/UI libraries.
Save only preferences and report config to LocalStorage. Do not store raw financial data.

The preview must show financial statement tables and diagnostics.
```

### Milestone 4 — ChartDataModel + D3 Preview

#### Goal

Implement ChartDataModel and animated D3 chart preview in the SPA.

#### Scope

- ChartDataModel builder
- KPI cards
- Revenue / GP / Net income trend
- P&L waterfall
- Assets composition
- Liabilities & equity composition
- Working capital chart
- D3 animation
- Basic tooltip
- YTD / period activity toggle
- Amount scale toggle
- Chart error placeholder

#### Non-goals

- No Reveal export yet.
- No second chart implementation.

#### Acceptance Criteria

- D3 renderers are reusable outside React.
- React only provides chart containers.
- Charts animate on render.
- Tooltips show line / period / amount.
- Chart rendering errors produce visible placeholders and diagnostics.

#### Codex Prompt Block

```text
Implement Milestone 4.

Create ChartDataModel and D3 renderers.
D3 must directly render SVG into a provided container.
React must not own SVG internals.

The same renderer functions must be reusable in the exported Reveal runtime.
Implement YTD/activity and amount-scale toggles.
```

### Milestone 5 — Reveal.js Export

#### Goal

Export a self-contained interactive Reveal.js HTML report with embedded D3 runtime.

#### Scope

- SlideModel
- Slide checklist
- Theme presets
- Theme preview
- Self-contained HTML renderer
- Embedded Reveal runtime
- Embedded D3 runtime
- Embedded StatementModel / ChartDataModel
- Runtime controls:
  - amount scale
  - YTD / period activity
  - replay animation
- D3 render on Reveal ready / slidechanged
- Appendix expandable tables
- Diagnostics slides
- Print stylesheet
- Offline validation

#### Non-goals

- No backend rendering.
- No CDN dependency in exported report.
- No raw Excel data embedded.

#### Acceptance Criteria

- Exported HTML opens offline.
- Reveal.js navigation works offline.
- D3 charts render and animate offline.
- Runtime controls work.
- Diagnostics appendix is visible.
- Report includes StatementModel and ChartDataModel JSON but not the original full Excel workbook.

#### Codex Prompt Block

```text
Implement Milestone 5.

Generate a self-contained Reveal.js HTML report.
Do not rely on CDN or network calls.
Embed Reveal runtime, D3 runtime, theme CSS, StatementModel JSON, ChartDataModel JSON, and chart renderers.

Charts must render on Reveal ready and slidechanged events.
Appendix tables must support expand/collapse.
```

### Milestone 6 — Documentation + Release

#### Goal

Complete open-source documentation and prepare v0.1.0.

#### Scope

- README
- docs
- ADRs
- privacy note
- examples
- CI validation
- release checklist

#### Acceptance Criteria

- README has quick start, Excel schema, privacy note, development guide, and Chinese notes.
- Docs explain architecture and mapping rules.
- ADRs document key decisions.
- GitHub Pages demo builds.
- v0.1.0 release checklist is complete.

## 5. Acceptance Summary

1. `sample-valid.xlsx` can be uploaded without blocking diagnostics.
2. BS / PL amounts match expected StatementModel.
3. `sample-with-warnings.xlsx` produces expected warnings.
4. User can preview FS tables and D3 charts.
5. User can select theme and slides.
6. User can export self-contained Reveal HTML.
7. Exported HTML opens offline and D3 charts animate.
8. CI passes lint, typecheck, tests, build, and deploy.
