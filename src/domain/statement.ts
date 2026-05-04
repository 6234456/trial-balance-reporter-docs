import Decimal from "decimal.js";

import type {
  MappingRule,
  ParsedWorkbook,
  Period,
  StatementAmount,
  StatementLine,
  StatementModel,
  StatementTree,
} from "../types";

const BALANCE_TOLERANCE = 0.005;

type LineAmounts = Record<string, Record<string, number>>;

export function buildStatementModel(parsed: ParsedWorkbook): StatementModel {
  const rules = [...parsed.mappingRules].sort((a, b) => a.sortOrder - b.sortOrder);
  const amounts = initializeLineAmounts(rules, parsed.periods);

  aggregateDetailAmounts(parsed, rules, amounts);
  evaluateFormulaAmounts(rules, parsed.periods, amounts);
  aggregateParentAmounts(rules, parsed.periods, amounts);

  const lines = rules.map((rule) => buildStatementLine(rule, parsed.periods, amounts));
  const balanceSheet = buildStatementTree(lines.filter((line) => line.statement === "BS"), "BS");
  const profitOrLoss = buildStatementTree(lines.filter((line) => line.statement === "PL"), "PL");

  return {
    schemaVersion: "1.0",
    sourceFixture: parsed.sourceName,
    periods: parsed.periods,
    currency: parsed.accountAggregates[0]?.currency ?? "",
    views: ["ending_balance", "movement", "pl_ytd", "pl_period_activity"],
    statements: {
      balanceSheet,
      profitOrLoss,
    },
    checks: {
      tbByPeriod: buildTbChecks(parsed),
      fsByPeriod: buildFsChecks(parsed.periods, balanceSheet.linesById),
    },
  };
}

function initializeLineAmounts(rules: MappingRule[], periods: Period[]): LineAmounts {
  return Object.fromEntries(
    rules.map((rule) => [
      rule.lineId,
      Object.fromEntries(periods.map((period) => [period.reportingDate, 0])),
    ]),
  );
}

function aggregateDetailAmounts(parsed: ParsedWorkbook, rules: MappingRule[], amounts: LineAmounts): void {
  const ruleByLineId = new Map(rules.map((rule) => [rule.lineId, rule]));

  for (const account of parsed.accountAggregates) {
    const mappedLineId = parsed.accountMappings[account.accountCode];

    if (!mappedLineId) {
      continue;
    }

    const rule = ruleByLineId.get(mappedLineId);

    if (!rule) {
      continue;
    }

    for (const period of parsed.periods) {
      const periodAmount = account.amountsByPeriod[period.reportingDate] ?? 0;
      const ruleAmounts = amounts[rule.lineId];

      if (!ruleAmounts) {
        continue;
      }

      ruleAmounts[period.reportingDate] = new Decimal(ruleAmounts[period.reportingDate] ?? 0)
        .plus(new Decimal(periodAmount).times(rule.sign))
        .toNumber();
    }
  }
}

function evaluateFormulaAmounts(rules: MappingRule[], periods: Period[], amounts: LineAmounts): void {
  const formulaRules = rules.filter((rule) => rule.sourceFormula);

  for (let pass = 0; pass < Math.max(1, formulaRules.length); pass += 1) {
    for (const rule of formulaRules) {
      for (const period of periods) {
        const ruleAmounts = amounts[rule.lineId];

        if (!ruleAmounts) {
          continue;
        }

        ruleAmounts[period.reportingDate] = evaluateFormula(rule.sourceFormula, (lineId) => {
          return amounts[lineId]?.[period.reportingDate] ?? 0;
        });
      }
    }
  }
}

function aggregateParentAmounts(rules: MappingRule[], periods: Period[], amounts: LineAmounts): void {
  const childrenByParent = new Map<string, MappingRule[]>();

  for (const rule of rules) {
    if (!rule.parentLineId || !rule.includeInParentTotal) {
      continue;
    }

    childrenByParent.set(rule.parentLineId, [...(childrenByParent.get(rule.parentLineId) ?? []), rule]);
  }

  const calculate = (parentLineId: string, period: Period, visiting: Set<string>): number => {
    if (visiting.has(parentLineId)) {
      return 0;
    }

    visiting.add(parentLineId);
    const children = childrenByParent.get(parentLineId) ?? [];
    let total = new Decimal(0);

    for (const child of children) {
      const childChildren = childrenByParent.get(child.lineId);
      const childAmount = childChildren
        ? calculate(child.lineId, period, visiting)
        : (amounts[child.lineId]?.[period.reportingDate] ?? 0);
      total = total.plus(childAmount);
    }

    visiting.delete(parentLineId);
    const parentAmounts = amounts[parentLineId];

    if (parentAmounts) {
      parentAmounts[period.reportingDate] = total.toNumber();
    }

    return total.toNumber();
  };

  for (const period of periods) {
    for (const rule of rules.filter((candidate) => candidate.lineType === "header")) {
      calculate(rule.lineId, period, new Set<string>());
    }
  }
}

function buildStatementLine(rule: MappingRule, periods: Period[], amounts: LineAmounts): StatementLine {
  return {
    lineId: rule.lineId,
    statement: rule.statement,
    lineType: rule.lineType,
    parentLineId: rule.parentLineId,
    label: rule.label,
    sortOrder: rule.sortOrder,
    chartGroup: rule.chartGroup,
    chartRole: rule.chartRole,
    includeInParentTotal: rule.includeInParentTotal,
    amountsByPeriod: Object.fromEntries(
      periods.map((period, periodIndex) => {
        const ruleAmounts = amounts[rule.lineId];
        const current = ruleAmounts?.[period.reportingDate] ?? 0;
        const previousPeriod = periods[periodIndex - 1];
        const previous = previousPeriod ? (ruleAmounts?.[previousPeriod.reportingDate] ?? 0) : null;

        return [
          period.reportingDate,
          buildAmount(rule.statement, current, previous, previousPeriod, period),
        ];
      }),
    ),
    children: [],
  };
}

function buildAmount(
  statement: MappingRule["statement"],
  current: number,
  previous: number | null,
  previousPeriod: Period | undefined,
  period: Period,
): StatementAmount {
  if (statement === "BS") {
    return {
      presentationAmount: current,
      endingBalance: current,
      movementAmount: previous === null ? null : new Decimal(current).minus(previous).toNumber(),
    };
  }

  const periodActivity =
    previous !== null && previousPeriod?.fiscalYear === period.fiscalYear ? new Decimal(current).minus(previous).toNumber() : current;

  return {
    presentationAmount: current,
    ytdAmount: current,
    periodActivityAmount: periodActivity,
  };
}

function buildStatementTree(lines: StatementLine[], statement: "BS" | "PL"): StatementTree {
  const sortedLines = [...lines].sort((a, b) => a.sortOrder - b.sortOrder);
  const linesById: Record<string, StatementLine> = Object.fromEntries(
    sortedLines.map((line) => [line.lineId, { ...line, children: [] }]),
  );

  for (const line of sortedLines) {
    const parent = line.parentLineId ? linesById[line.parentLineId] : undefined;

    if (parent) {
      parent.children.push(line.lineId);
    }
  }

  const rootLineIds = sortedLines
    .filter((line) => !line.parentLineId)
    .filter((line) => (statement === "BS" ? line.includeInParentTotal : true))
    .map((line) => line.lineId);

  return {
    rootLineIds,
    lines: sortedLines.map((line) => linesById[line.lineId]).filter((line): line is StatementLine => Boolean(line)),
    linesById,
  };
}

function buildTbChecks(parsed: ParsedWorkbook): StatementModel["checks"]["tbByPeriod"] {
  return Object.fromEntries(
    parsed.periods.map((period) => {
      const difference = parsed.accountAggregates
        .reduce((total, account) => total.plus(account.amountsByPeriod[period.reportingDate] ?? 0), new Decimal(0))
        .toNumber();

      return [period.reportingDate, { difference, isBalanced: Math.abs(difference) <= BALANCE_TOLERANCE }];
    }),
  );
}

function buildFsChecks(
  periods: Period[],
  linesById: Record<string, StatementLine>,
): StatementModel["checks"]["fsByPeriod"] {
  return Object.fromEntries(
    periods.map((period) => {
      const assets = linesById.BS_ASSETS?.amountsByPeriod[period.reportingDate]?.presentationAmount ?? 0;
      const liabilities = linesById.BS_LIABILITIES?.amountsByPeriod[period.reportingDate]?.presentationAmount ?? 0;
      const equity = linesById.BS_EQUITY?.amountsByPeriod[period.reportingDate]?.presentationAmount ?? 0;
      const difference = new Decimal(assets).minus(liabilities).minus(equity).toNumber();

      return [period.reportingDate, { difference, isBalanced: Math.abs(difference) <= BALANCE_TOLERANCE }];
    }),
  );
}

function evaluateFormula(formula: string, getValue: (lineId: string) => number): number {
  const tokens = formula.match(/[+-]|[A-Z][A-Z0-9_]*/g) ?? [];
  let sign = 1;
  let total = new Decimal(0);

  for (const token of tokens) {
    if (token === "+") {
      sign = 1;
      continue;
    }

    if (token === "-") {
      sign = -1;
      continue;
    }

    total = total.plus(new Decimal(getValue(token)).times(sign));
    sign = 1;
  }

  return total.toNumber();
}
