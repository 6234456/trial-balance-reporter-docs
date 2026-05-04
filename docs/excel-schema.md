# Excel Schema

## Workbook Contract

The input workbook MUST contain exactly these required sheets:

- `TB`
- `Mapping`

The MVP UI exposes only `.xlsx` upload. CSV is supported internally for tests and fixture generation.

## TB Sheet

The `TB` sheet uses **wide format**.

- Metadata columns MUST start with `#`.
- Amount columns MUST NOT start with `#`.
- Amount columns MUST be ISO dates: `YYYY-MM-DD`.
- Amount sign convention: positive = debit; negative = credit.
- P&L accounts are YTD values.
- BS accounts are period-end balances.

### Required Metadata Columns

| Column | Required | Meaning |
|---|---:|---|
| `#account_code` | Yes | Account code. Parsed internally as string. |
| `#account_name` | Yes | Account name. |
| `#currency` | Yes | Currency. MVP defaults to blocking if multiple currencies are detected. |

### Optional Metadata Columns

| Column | Meaning |
|---|---|
| `#entity_id` | Entity identifier. MVP ignores entity and aggregates all rows. |
| `#entity_name` | Entity name. Used to infer default company name. |
| `#normal_balance` | `D` or `C`; used for warning only. |
| `#account_group` | Display / trace metadata. |
| `#cost_center` | Preserved for trace; ignored in MVP aggregation. |
| `#note` | Optional comment. |

### Example

```csv
#entity_id,#entity_name,#currency,#account_code,#account_name,#normal_balance,#account_group,#cost_center,#note,2024-12-31,2025-03-31
DEMO,Demo Manufacturing GmbH,EUR,100000,Cash and bank,D,Cash,,,700000,760000
DEMO,Demo Manufacturing GmbH,EUR,400000,Revenue,C,Revenue,,YTD PL,-3800000,-950000
```

## Mapping Sheet

### Required Columns

| Column | Meaning |
|---|---|
| `#rule_id` | Unique rule identifier. |
| `#statement` | `BS` or `PL`. |
| `#line_id` | Statement line identifier. |
| `#line_label_en` | English label. |
| `#line_label_zh` | Chinese label. |
| `#line_type` | `header`, `detail`, `subtotal`, `synthetic`, `check`. |
| `#sign` | Presentation sign multiplier: `1` or `-1`. |
| `#sort_order` | Numeric display order. |

### Parser Rules

| Rule | Behavior |
|---|---|
| Account codes | Internally string. Numeric Excel values are converted to integer-like strings when safe. |
| Empty amount cells | Treated as zero and counted in diagnostics. |
| Duplicate account rows | Aggregated by account + period; original trace retained. |
| Duplicate account names | Use first name and emit warning. |
| Date columns | Sorted by date, but original Excel order retained in trace. |
| Multiple currencies | Blocking diagnostic in MVP. |
| Range matching | Numeric only for digit-only account codes. |
