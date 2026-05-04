# Diagnostics

| Severity | Meaning | Blocks report generation |
|---|---|---:|
| `blocking` | Input or model cannot be processed safely. | Yes |
| `warning` | Report can be generated but result requires attention. | No |
| `info` | Informational message. | No |

## Diagnostic Codes

| Code | Severity | Trigger | Blocking |
|---|---|---|---:|
| `BLOCKING_MISSING_TB_SHEET` | blocking | No `TB` sheet found | Yes |
| `BLOCKING_MISSING_MAPPING_SHEET` | blocking | No `Mapping` sheet found | Yes |
| `BLOCKING_MISSING_REQUIRED_COLUMN` | blocking | Required column missing | Yes |
| `BLOCKING_INVALID_DATE_COLUMN` | blocking | Non-ISO date amount column | Yes |
| `BLOCKING_MULTIPLE_CURRENCIES` | blocking | More than one currency found | Yes |
| `BLOCKING_STATEMENT_TREE_INVALID` | blocking | Missing parent / cycle / duplicate non-detail line | Yes |
| `WARN_BLANK_AMOUNT_AS_ZERO` | warning | Blank amount cell | No |
| `WARN_DUPLICATE_ACCOUNT_NAME` | warning | Same account code, different names | No |
| `WARN_MAPPING_CONFLICT` | warning | Multiple mapping rules match | No |
| `WARN_UNMAPPED_NON_ZERO_ACCOUNT` | warning | Non-zero account not mapped | No |
| `WARN_TB_NOT_BALANCED` | warning | TB signed sum != 0 | No |
| `WARN_FS_NOT_BALANCED` | warning | Assets - liabilities - equity != 0 | No |
| `WARN_NORMAL_BALANCE_CONFLICT` | warning | D/C conflicts with amount sign | No |
| `INFO_UNMAPPED_ZERO_ACCOUNT` | info | Zero account not mapped | No |
| `INFO_PERIOD_COLUMNS_DETECTED` | info | Date columns parsed | No |
| `INFO_SINGLE_CURRENCY` | info | One currency found | No |
