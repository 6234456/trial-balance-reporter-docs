# trial-balance-reporter

Browser-only Trial Balance + Mapping to Financial Statement and interactive Reveal.js report generator.

## What it does

`trial-balance-reporter` reads a single Excel workbook with two sheets:

- `TB`
- `Mapping`

It transforms trial balance data into financial statements, validates mapping and balance integrity, previews statements and D3 charts, and exports a self-contained interactive Reveal.js HTML report.

## Privacy

All Excel processing happens locally in your browser. No Excel file is uploaded to any server. The MVP must not store raw financial data in LocalStorage.

## Quick Start

```bash
pnpm install
pnpm dev
```

Open the local Vite URL and either:

1. click **Load Demo**, or
2. upload an Excel workbook containing `TB` and `Mapping`.

## Excel Input

See [`docs/excel-schema.md`](docs/excel-schema.md).

## Development

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Chinese Notes / 中文说明

本项目是一个纯浏览器端财务报表生成工具。用户上传包含 `TB` 与 `Mapping` 两张表的 Excel 文件后，程序在本地完成解析、映射、校验、报表生成、图表预览，并导出可离线打开的交互式 Reveal.js HTML 报告。

第一版不包含后端、不上传文件、不保存原始财务数据。
