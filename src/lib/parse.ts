// SheetJS-driven CSV/XLSX parser with editorial-grade defaults:
//   - anchor header row detection (skips banner/blank rows above the table)
//   - UK date coercion (DD/MM/YYYY -> ISO YYYY-MM-DD)
//   - IDs kept as strings, preserving leading zeros
//   - numeric strings coerced to numbers only for non-id columns

import * as XLSX from "xlsx";

import { parseMaybeDate } from "./profile";

export type ParsedFile = {
  filename: string;
  rows: Array<Record<string, unknown>>;
  headers: string[];
};

const ID_HINT = /(^|[_\s])(id|code|sku|ref|reference|postcode|zip)($|[_\s])/i;

/** Find the row index that looks like the real header — first row with
 *  >= 2 non-empty cells and no cell that looks like a title/banner. */
function findHeaderRow(matrix: unknown[][]): number {
  for (let i = 0; i < Math.min(matrix.length, 20); i++) {
    const row = matrix[i] ?? [];
    const nonEmpty = row.filter((c) => c !== null && c !== undefined && String(c).trim() !== "");
    if (nonEmpty.length >= 2) {
      // A header row: cells are short-ish strings, not sentences.
      const allShort = nonEmpty.every((c) => String(c).length <= 48 && !/[.!?]$/.test(String(c).trim()));
      if (allShort) return i;
    }
  }
  return 0;
}

function coerceCell(header: string, raw: unknown): unknown {
  if (raw === null || raw === undefined) return null;
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null;
    return raw.toISOString().slice(0, 10);
  }
  const isIdColumn = ID_HINT.test(header);
  if (typeof raw === "string") {
    const s = raw.trim();
    if (s === "") return null;
    if (isIdColumn) return s; // preserve leading zeros
    // UK date?
    const t = parseMaybeDate(s);
    if (t !== null && /[\/\-]/.test(s)) return new Date(t).toISOString().slice(0, 10);
    // Numeric?
    if (!/^0\d/.test(s) && s !== "" && !Number.isNaN(Number(s.replace(/,/g, "")))) {
      return Number(s.replace(/,/g, ""));
    }
    return s;
  }
  if (typeof raw === "number") return isIdColumn ? String(raw) : raw;
  return raw;
}

export async function parseFile(file: File): Promise<ParsedFile> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", cellDates: true, raw: false });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    raw: false,
    defval: null,
    blankrows: false,
  });

  const headerIdx = findHeaderRow(matrix);
  const headerRow = (matrix[headerIdx] ?? []).map((c, i) => {
    const s = c === null || c === undefined ? "" : String(c).trim();
    return s || `column_${i + 1}`;
  });

  const rows: Record<string, unknown>[] = [];
  for (let r = headerIdx + 1; r < matrix.length; r++) {
    const rowArr = matrix[r] ?? [];
    const obj: Record<string, unknown> = {};
    let anyValue = false;
    for (let c = 0; c < headerRow.length; c++) {
      const h = headerRow[c];
      const v = coerceCell(h, rowArr[c]);
      obj[h] = v;
      if (v !== null && v !== undefined && v !== "") anyValue = true;
    }
    if (anyValue) rows.push(obj);
  }

  return { filename: file.name, rows, headers: headerRow };
}
