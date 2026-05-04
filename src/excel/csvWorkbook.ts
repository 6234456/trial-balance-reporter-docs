import Decimal from "decimal.js";

import type {
  AccountAggregate,
  Diagnostic,
  DiagnosticReport,
  DiagnosticSeverity,
  MappingRule,
  MatchType,
  ParsedWorkbook,
  Period,
  TbRow,
} from "../types";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const TB_REQUIRED_COLUMNS = ["#account_code", "#account_name", "#currency"] as const;

const MAPPING_REQUIRED_COLUMNS = [
  "#rule_id",
  "#statement",
  "#line_id",
  "#line_label_en",
  "#line_label_zh",
  "#line_type",
  "#sign",
  "#sort_order",
] as const;

type CsvWorkbookInput = {
  tbCsv: string;
  mappingCsv: string;
  sourceName: string;
};

type DiagnosticsBuilder = {
  sourceName: string;
  items: Diagnostic[];
};

export function parseCsvWorkbook(input: CsvWorkbookInput): ParsedWorkbook {
  return parseWorkbookRows({
    tbRows: parseCsv(input.tbCsv),
    mappingRows: parseCsv(input.mappingCsv),
    sourceName: input.sourceName,
  });
}

export function parseWorkbookRows(input: {
  tbRows: string[][];
  mappingRows: string[][];
  sourceName: string;
}): ParsedWorkbook {
  const diagnostics: DiagnosticsBuilder = { sourceName: input.sourceName, items: [] };
  addDiagnostic(diagnostics, "INFO_SHEETS_FOUND", "info", "diagnostics.info.sheetsFound", "TB and Mapping sheets found.");

  const tbHeader = input.tbRows[0] ?? [];
  const mappingHeader = input.mappingRows[0] ?? [];
  const tbIndex = createColumnIndex(tbHeader);
  const mappingIndex = createColumnIndex(mappingHeader);

  for (const column of TB_REQUIRED_COLUMNS) {
    if (!tbIndex.has(column)) {
      addDiagnostic(
        diagnostics,
        "BLOCKING_MISSING_REQUIRED_COLUMN",
        "blocking",
        "diagnostics.blocking.missingRequiredColumn",
        `Missing required TB column ${column}.`,
        { sheet: "TB", column },
      );
    }
  }

  for (const column of MAPPING_REQUIRED_COLUMNS) {
    if (!mappingIndex.has(column)) {
      addDiagnostic(
        diagnostics,
        "BLOCKING_MISSING_REQUIRED_COLUMN",
        "blocking",
        "diagnostics.blocking.missingRequiredColumn",
        `Missing required Mapping column ${column}.`,
        { sheet: "Mapping", column },
      );
    }
  }

  const periodColumns = tbHeader
    .map((columnName, columnIndex) => ({ columnName: columnName.trim(), columnIndex }))
    .filter(({ columnName }) => !columnName.startsWith("#"));

  for (const periodColumn of periodColumns) {
    if (!ISO_DATE.test(periodColumn.columnName)) {
      addDiagnostic(
        diagnostics,
        "BLOCKING_INVALID_DATE_COLUMN",
        "blocking",
        "diagnostics.blocking.invalidDateColumn",
        `Amount column ${periodColumn.columnName} is not an ISO date.`,
        { column: periodColumn.columnName },
      );
    }
  }

  const periods: Period[] = [...periodColumns]
    .filter(({ columnName }) => ISO_DATE.test(columnName))
    .sort((a, b) => a.columnName.localeCompare(b.columnName))
    .map((periodColumn, index) => ({
      reportingDate: periodColumn.columnName,
      fiscalYear: periodColumn.columnName.slice(0, 4),
      sourceColumnIndex: periodColumn.columnIndex,
      displayOrder: index + 1,
    }));

  addDiagnostic(
    diagnostics,
    "INFO_PERIOD_COLUMNS_DETECTED",
    "info",
    "diagnostics.info.periodColumnsDetected",
    `${periods.length} period columns detected.`,
    { count: periods.length },
  );

  const tbRows = parseTbRows(input.tbRows.slice(1), tbIndex, periods, diagnostics);
  const currencies = new Set(tbRows.map((row) => row.currency).filter(Boolean));

  if (currencies.size > 1) {
    addDiagnostic(
      diagnostics,
      "BLOCKING_MULTIPLE_CURRENCIES",
      "blocking",
      "diagnostics.blocking.multipleCurrencies",
      "Multiple currencies were detected in the TB sheet.",
      { currencies: [...currencies].join(", ") },
    );
  } else if (currencies.size === 1) {
    const currency = [...currencies][0] ?? "";
    addDiagnostic(
      diagnostics,
      "INFO_SINGLE_CURRENCY",
      "info",
      "diagnostics.info.singleCurrency",
      `Single currency detected: ${currency}.`,
      { currency },
    );
  }

  const mappingRules = parseMappingRules(input.mappingRows.slice(1), mappingIndex);
  const accountAggregates = aggregateAccounts(tbRows, periods, diagnostics);
  const accountMappings = analyzeAccountMappings(accountAggregates, mappingRules, periods, diagnostics);

  return {
    sourceName: input.sourceName,
    periods,
    tbRows,
    mappingRules,
    accountAggregates,
    accountMappings,
    diagnostics: buildDiagnosticReport(diagnostics),
  };
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        field += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char ?? "";
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => cell.trim().length > 0));
}

function parseTbRows(
  rows: string[][],
  index: Map<string, number>,
  periods: Period[],
  diagnostics: DiagnosticsBuilder,
): TbRow[] {
  const parsedRows: TbRow[] = [];

  rows.forEach((row, rowIndex) => {
    const metadata: Record<string, string> = {};

    for (const [column, columnIndex] of index.entries()) {
      if (column.startsWith("#")) {
        metadata[column] = cell(row, columnIndex);
      }
    }

    const amountsByPeriod: Record<string, number> = {};

    for (const period of periods) {
      const rawAmount = cell(row, period.sourceColumnIndex);

      if (rawAmount === "") {
        addDiagnostic(
          diagnostics,
          "WARN_BLANK_AMOUNT_AS_ZERO",
          "warning",
          "diagnostics.warning.blankAmountAsZero",
          `Blank amount treated as zero for ${metadata["#account_code"] ?? "unknown"} ${period.reportingDate}.`,
          { accountCode: metadata["#account_code"] ?? "", reportingDate: period.reportingDate },
        );
      }

      amountsByPeriod[period.reportingDate] = parseAmount(rawAmount);
    }

    parsedRows.push({
      sourceRowIndex: rowIndex + 2,
      accountCode: normalizeAccountCode(metadata["#account_code"] ?? ""),
      accountName: metadata["#account_name"] ?? "",
      currency: metadata["#currency"] ?? "",
      normalBalance: metadata["#normal_balance"] ?? "",
      amountsByPeriod,
      metadata,
    });
  });

  return parsedRows;
}

function parseMappingRules(rows: string[][], index: Map<string, number>): MappingRule[] {
  return rows.map((row) => ({
    ruleId: cell(row, index.get("#rule_id")),
    statement: cell(row, index.get("#statement")) === "PL" ? "PL" : "BS",
    section: cell(row, index.get("#section")),
    lineId: cell(row, index.get("#line_id")),
    parentLineId: emptyToNull(cell(row, index.get("#parent_line_id"))),
    label: {
      en: cell(row, index.get("#line_label_en")),
      zh: cell(row, index.get("#line_label_zh")),
    },
    lineType: parseLineType(cell(row, index.get("#line_type"))),
    matchType: parseMatchType(cell(row, index.get("#match_type"))),
    accountFrom: normalizeAccountCode(cell(row, index.get("#account_from"))),
    accountTo: normalizeAccountCode(cell(row, index.get("#account_to"))),
    accountPrefix: normalizeAccountCode(cell(row, index.get("#account_prefix"))),
    sign: cell(row, index.get("#sign")) === "-1" ? -1 : 1,
    sortOrder: Number.parseFloat(cell(row, index.get("#sort_order"))) || 0,
    chartGroup: cell(row, index.get("#chart_group")),
    chartRole: cell(row, index.get("#chart_role"))
      .split(",")
      .map((role) => role.trim())
      .filter(Boolean),
    sourceFormula: cell(row, index.get("#source_formula")),
    includeInParentTotal: parseBoolean(cell(row, index.get("#include_in_parent_total"))),
    note: cell(row, index.get("#note")),
  }));
}

function aggregateAccounts(rows: TbRow[], periods: Period[], diagnostics: DiagnosticsBuilder): AccountAggregate[] {
  const byAccount = new Map<string, AccountAggregate>();
  const namesByAccount = new Map<string, Set<string>>();

  for (const row of rows) {
    const existing = byAccount.get(row.accountCode);

    if (!existing) {
      byAccount.set(row.accountCode, {
        accountCode: row.accountCode,
        accountName: row.accountName,
        currency: row.currency,
        amountsByPeriod: Object.fromEntries(periods.map((period) => [period.reportingDate, 0])),
        sourceRowIndexes: [],
      });
    }

    const aggregate = byAccount.get(row.accountCode);

    if (!aggregate) {
      continue;
    }

    aggregate.sourceRowIndexes.push(row.sourceRowIndex);

    for (const period of periods) {
      aggregate.amountsByPeriod[period.reportingDate] = new Decimal(aggregate.amountsByPeriod[period.reportingDate] ?? 0)
        .plus(row.amountsByPeriod[period.reportingDate] ?? 0)
        .toNumber();
    }

    const names = namesByAccount.get(row.accountCode) ?? new Set<string>();
    if (row.accountName) {
      names.add(row.accountName);
    }
    namesByAccount.set(row.accountCode, names);
  }

  for (const [accountCode, names] of namesByAccount.entries()) {
    if (names.size > 1) {
      addDiagnostic(
        diagnostics,
        "WARN_DUPLICATE_ACCOUNT_NAME",
        "warning",
        "diagnostics.warning.duplicateAccountName",
        `Account ${accountCode} has multiple account names.`,
        { accountCode },
      );
    }
  }

  return [...byAccount.values()].sort((a, b) => a.accountCode.localeCompare(b.accountCode));
}

function analyzeAccountMappings(
  accounts: AccountAggregate[],
  rules: MappingRule[],
  periods: Period[],
  diagnostics: DiagnosticsBuilder,
): Record<string, string | null> {
  const detailRules = rules.filter((rule) => rule.lineType === "detail" && rule.matchType);
  const accountMappings: Record<string, string | null> = {};

  for (const account of accounts) {
    const matches = detailRules.filter((rule) => ruleMatchesAccount(rule, account.accountCode));
    const sortedMatches = [...matches].sort((a, b) => specificity(b) - specificity(a) || a.sortOrder - b.sortOrder);
    const selected = sortedMatches[0];

    if (!selected) {
      const hasNonZeroAmount = periods.some((period) => Math.abs(account.amountsByPeriod[period.reportingDate] ?? 0) > 0);
      accountMappings[account.accountCode] = null;

      if (hasNonZeroAmount) {
        addDiagnostic(
          diagnostics,
          "WARN_UNMAPPED_NON_ZERO_ACCOUNT",
          "warning",
          "diagnostics.warning.unmappedNonZeroAccount",
          `Non-zero account ${account.accountCode} is not mapped.`,
          { accountCode: account.accountCode },
        );
      } else {
        addDiagnostic(
          diagnostics,
          "INFO_UNMAPPED_ZERO_ACCOUNT",
          "info",
          "diagnostics.info.unmappedZeroAccount",
          `Zero account ${account.accountCode} is not mapped.`,
          { accountCode: account.accountCode },
        );
      }

      continue;
    }

    accountMappings[account.accountCode] = selected.lineId;

    for (const conflicting of sortedMatches.slice(1)) {
      addDiagnostic(
        diagnostics,
        "WARN_MAPPING_CONFLICT",
        "warning",
        "diagnostics.warning.mappingConflict",
        `Account ${account.accountCode} matched multiple mapping rules.`,
        {
          accountCode: account.accountCode,
          selectedRuleId: selected.ruleId,
          conflictingRuleId: conflicting.ruleId,
        },
      );
    }
  }

  return accountMappings;
}

export function ruleMatchesAccount(rule: MappingRule, accountCode: string): boolean {
  if (rule.matchType === "exact") {
    return accountCode === rule.accountFrom;
  }

  if (rule.matchType === "prefix") {
    return rule.accountPrefix !== "" && accountCode.startsWith(rule.accountPrefix);
  }

  if (rule.matchType === "range") {
    if (!/^\d+$/.test(accountCode) || !/^\d+$/.test(rule.accountFrom) || !/^\d+$/.test(rule.accountTo)) {
      return false;
    }

    const account = Number.parseInt(accountCode, 10);
    return account >= Number.parseInt(rule.accountFrom, 10) && account <= Number.parseInt(rule.accountTo, 10);
  }

  return false;
}

function specificity(rule: MappingRule): number {
  if (rule.matchType === "exact") {
    return 3;
  }
  if (rule.matchType === "range") {
    return 2;
  }
  if (rule.matchType === "prefix") {
    return 1;
  }
  return 0;
}

function buildDiagnosticReport(builder: DiagnosticsBuilder): DiagnosticReport {
  const summary: Record<DiagnosticSeverity, number> = {
    blocking: 0,
    warning: 0,
    info: 0,
  };

  for (const item of builder.items) {
    summary[item.severity] += 1;
  }

  return {
    sourceFixture: builder.sourceName,
    summary,
    items: builder.items,
  };
}

function addDiagnostic(
  builder: DiagnosticsBuilder,
  code: string,
  severity: DiagnosticSeverity,
  messageKey: string,
  message: string,
  meta?: Record<string, string | number | boolean | null>,
): void {
  builder.items.push({
    code,
    severity,
    messageKey,
    message,
    ...(meta ? { meta } : {}),
  });
}

function createColumnIndex(header: string[]): Map<string, number> {
  const index = new Map<string, number>();

  header.forEach((columnName, columnIndex) => {
    index.set(columnName.trim(), columnIndex);
  });

  return index;
}

function cell(row: string[], index?: number): string {
  if (index === undefined) {
    return "";
  }
  return (row[index] ?? "").trim();
}

function parseAmount(value: string): number {
  const normalized = value.trim().replaceAll(",", "");
  if (normalized === "") {
    return 0;
  }
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeAccountCode(value: string): string {
  const trimmed = value.trim();
  if (/^\d+(\.0+)?$/.test(trimmed)) {
    return trimmed.split(".")[0] ?? trimmed;
  }
  return trimmed;
}

function emptyToNull(value: string): string | null {
  return value === "" ? null : value;
}

function parseLineType(value: string): MappingRule["lineType"] {
  if (value === "header" || value === "detail" || value === "subtotal" || value === "synthetic" || value === "check") {
    return value;
  }
  return "detail";
}

function parseMatchType(value: string): MatchType {
  if (value === "exact" || value === "range" || value === "prefix") {
    return value;
  }
  return "";
}

function parseBoolean(value: string): boolean {
  return value.toLowerCase() === "true" || value === "1" || value.toLowerCase() === "yes";
}
