# Domain Model

## Core Types

```ts
type LocalizedText = { en: string; zh: string };

type DiagnosticSeverity = "blocking" | "warning" | "info";

type ReportConfig = {
  title: string;
  companyName: string;
  reportPeriodLabel: string;
  language: "en" | "zh" | "bilingual";
  amountScale: "raw" | "thousand" | "million";
  plViewMode: "ytd" | "period_activity";
  themeId: string;
  selectedSlideIds: string[];
  generatedAt: string;
};
```

## TB Normalization

A wide TB row is transformed into multiple normalized rows.

```ts
type NormalizedTBRow = {
  sourceRowIndex: number;
  sourceColumnName: string;
  sourceColumnIndex: number;
  accountCode: string;
  accountName: string;
  currency: string;
  reportingDate: string;
  amountSigned: Decimal;
  trace: SourceTrace;
};
```
