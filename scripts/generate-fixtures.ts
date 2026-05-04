/**
 * Draft fixture generator.
 *
 * Intended behavior:
 * - read fixtures/csv/sample-valid/TB.csv and Mapping.csv
 * - read fixtures/csv/sample-with-warnings/TB.csv and Mapping.csv
 * - generate public/examples/sample-valid.xlsx
 * - generate public/examples/sample-with-warnings.xlsx
 *
 * Codex should complete this in Milestone 1.
 */

import * as XLSX from "xlsx";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseCsv } from "../src/excel/csvWorkbook";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function csvToRows(path: string): string[][] {
  const raw = readFileSync(path, "utf8");
  return parseCsv(raw);
}

function writeWorkbookFromCsvPair(inputDir: string, outputPath: string): void {
  const tbRows = csvToRows(resolve(ROOT, inputDir, "TB.csv"));
  const mappingRows = csvToRows(resolve(ROOT, inputDir, "Mapping.csv"));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(tbRows), "TB");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(mappingRows), "Mapping");

  mkdirSync(dirname(outputPath), { recursive: true });
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
  writeFileSync(outputPath, buffer);
}

writeWorkbookFromCsvPair("fixtures/csv/sample-valid", resolve(ROOT, "public/examples/sample-valid.xlsx"));
writeWorkbookFromCsvPair("fixtures/csv/sample-with-warnings", resolve(ROOT, "public/examples/sample-with-warnings.xlsx"));
