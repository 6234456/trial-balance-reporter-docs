# Testing Strategy

Use Vitest.

## Required Test Categories

1. Parser tests
2. Mapping engine tests
3. Formula tokenizer tests
4. StatementModel tests
5. Diagnostics tests
6. ChartDataModel tests
7. One smoke E2E-style test for upload → preview → export placeholder

## Fixture-based Integration Tests

The project MUST include sample-valid and sample-with-warnings fixtures with expected JSON outputs.
