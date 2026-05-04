export type DiagnosticSeverity = "blocking" | "warning" | "info";

export type StatementCode = "BS" | "PL";

export type LineType = "header" | "detail" | "subtotal" | "synthetic" | "check";

export type MatchType = "exact" | "range" | "prefix" | "";

export type StatementView = "ending_balance" | "movement" | "pl_ytd" | "pl_period_activity";

export type LanguageMode = "en" | "zh" | "bilingual";

export type AmountScale = "raw" | "thousand" | "million";

export type PlViewMode = "ytd" | "period_activity";

export type LocalizedText = {
  en: string;
  zh: string;
};

export type Diagnostic = {
  code: string;
  severity: DiagnosticSeverity;
  messageKey: string;
  message: string;
  meta?: Record<string, string | number | boolean | null>;
};

export type DiagnosticSummary = Record<DiagnosticSeverity, number>;

export type DiagnosticReport = {
  sourceFixture?: string;
  summary: DiagnosticSummary;
  items: Diagnostic[];
};

export type Period = {
  reportingDate: string;
  fiscalYear: string;
  sourceColumnIndex: number;
  displayOrder: number;
};

export type TbRow = {
  sourceRowIndex: number;
  accountCode: string;
  accountName: string;
  currency: string;
  normalBalance: string;
  amountsByPeriod: Record<string, number>;
  metadata: Record<string, string>;
};

export type MappingRule = {
  ruleId: string;
  statement: StatementCode;
  section: string;
  lineId: string;
  parentLineId: string | null;
  label: LocalizedText;
  lineType: LineType;
  matchType: MatchType;
  accountFrom: string;
  accountTo: string;
  accountPrefix: string;
  sign: 1 | -1;
  sortOrder: number;
  chartGroup: string;
  chartRole: string[];
  sourceFormula: string;
  includeInParentTotal: boolean;
  note: string;
};

export type AccountAggregate = {
  accountCode: string;
  accountName: string;
  currency: string;
  amountsByPeriod: Record<string, number>;
  sourceRowIndexes: number[];
};

export type ParsedWorkbook = {
  sourceName: string;
  periods: Period[];
  tbRows: TbRow[];
  mappingRules: MappingRule[];
  accountAggregates: AccountAggregate[];
  accountMappings: Record<string, string | null>;
  diagnostics: DiagnosticReport;
};

export type StatementAmount = {
  presentationAmount: number;
  endingBalance?: number | null;
  movementAmount?: number | null;
  ytdAmount?: number | null;
  periodActivityAmount?: number | null;
};

export type StatementLine = {
  lineId: string;
  statement: StatementCode;
  lineType: LineType;
  parentLineId: string | null;
  label: LocalizedText;
  sortOrder: number;
  chartGroup: string;
  chartRole: string[];
  includeInParentTotal: boolean;
  amountsByPeriod: Record<string, StatementAmount>;
  children: string[];
};

export type StatementTree = {
  rootLineIds: string[];
  lines: StatementLine[];
  linesById: Record<string, StatementLine>;
};

export type BalanceCheck = {
  difference: number;
  isBalanced: boolean;
};

export type StatementModel = {
  schemaVersion: "1.0";
  sourceFixture: string;
  periods: Period[];
  currency: string;
  views: StatementView[];
  statements: {
    balanceSheet: StatementTree;
    profitOrLoss: StatementTree;
  };
  checks: {
    tbByPeriod: Record<string, BalanceCheck>;
    fsByPeriod: Record<string, BalanceCheck>;
  };
};

export type ChartSpec = {
  chartId: string;
  chartType:
    | "kpi-cards"
    | "trend-line"
    | "waterfall"
    | "composition"
    | "paired-stacked-bar"
    | "working-capital"
    | "diagnostics-summary";
  title: LocalizedText;
  sourceLineIds: string[];
  data: unknown;
};

export type ChartDataModel = {
  schemaVersion: "1.0";
  sourceFixture: string;
  charts: ChartSpec[];
};

export type ReportConfig = {
  title: string;
  companyName: string;
  reportPeriodLabel: string;
  language: LanguageMode;
  amountScale: AmountScale;
  plViewMode: PlViewMode;
  themeId: string;
  selectedSlideIds: string[];
  generatedAt: string;
};
