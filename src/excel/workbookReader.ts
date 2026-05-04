import * as XLSX from "xlsx";

import { parseWorkbookRows } from "./csvWorkbook";
import type { ParsedWorkbook } from "../types";

export async function parseWorkbookFile(file: File): Promise<ParsedWorkbook> {
  const buffer = await file.arrayBuffer();
  return parseWorkbookArrayBuffer(buffer, file.name);
}

export function parseWorkbookArrayBuffer(buffer: ArrayBuffer, sourceName: string): ParsedWorkbook {
  const workbook = XLSX.read(buffer, { type: "array" });
  const tbSheet = workbook.Sheets["TB"];
  const mappingSheet = workbook.Sheets["Mapping"];

  return parseWorkbookRows({
    tbRows: tbSheet ? sheetToRows(tbSheet) : [],
    mappingRows: mappingSheet ? sheetToRows(mappingSheet) : [],
    sourceName,
  });
}

function sheetToRows(sheet: XLSX.WorkSheet): string[][] {
  const rows = XLSX.utils.sheet_to_json<Array<string | number | boolean | null>>(sheet, {
    header: 1,
    raw: false,
    defval: "",
  });

  return rows.map((row) => row.map((value) => String(value ?? "")));
}
