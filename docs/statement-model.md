# StatementModel

## Purpose

StatementModel is the canonical financial statement result.

```ts
type StatementModel = {
  schemaVersion: "1.0";
  periods: Period[];
  currency: string;
  views: StatementView[];
  statements: {
    balanceSheet: StatementTree;
    profitOrLoss: StatementTree;
  };
  checks: StatementChecks;
};
```

## Amount Views

| Statement | View | Meaning |
|---|---|---|
| BS | `ending_balance` | Period-end balance. |
| BS | `movement` | Current period ending balance less previous period ending balance. |
| PL | `pl_ytd` | YTD amount from TB. |
| PL | `pl_period_activity` | Derived by fiscal-year grouped adjacent-period subtraction. |

## Balance Checks

```text
TB Check:
sum(amount_signed) = 0

FS Check:
Total Assets - Total Liabilities - Total Equity = 0
```
