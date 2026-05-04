# Mapping Rules

## Match Types

| Match Type | Required Fields | Notes |
|---|---|---|
| `exact` | `#account_from` | Exact account code match. |
| `range` | `#account_from`, `#account_to` | Numeric range for digit-only account codes. |
| `prefix` | `#account_prefix` | String prefix match. |

## Specificity Ranking

```text
exact > range > prefix
```

If multiple rules match, the selected rule follows specificity ranking and `WARN_MAPPING_CONFLICT` is emitted.

## Signs

TB amounts use accounting sign:

```text
debit = positive
credit = negative
```

Presentation amount:

```text
presentationAmount = amountSigned × #sign
```

## Formulas

Allowed:

```text
PL_REVENUE-PL_COGS-PL_OPEX
BS_AR+BS_INVENTORY-BS_AP
```

`eval` MUST NOT be used.
