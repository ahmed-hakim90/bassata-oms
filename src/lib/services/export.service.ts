import * as XLSX from "xlsx";

export interface ExportColumn<T> {
  header: string;
  accessor: (row: T) => string | number | boolean | null | undefined;
  width?: number;
}

export interface ExportOptions {
  sheetName?: string;
  fileName?: string;
}

function rowsToSheet<T>(data: T[], columns: ExportColumn<T>[]): XLSX.WorkSheet {
  const headers = columns.map((c) => c.header);
  const rows = data.map((row) =>
    columns.map((col) => {
      const value = col.accessor(row);
      return value ?? "";
    })
  );
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  sheet["!cols"] = columns.map((col) => ({ wch: col.width ?? 18 }));
  return sheet;
}

export function exportToWorkbook<T>(
  data: T[],
  columns: ExportColumn<T>[],
  options: ExportOptions = {}
): XLSX.WorkBook {
  const sheet = rowsToSheet(data, columns);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, options.sheetName ?? "Sheet1");
  return workbook;
}

export function exportToBuffer<T>(
  data: T[],
  columns: ExportColumn<T>[],
  options: ExportOptions = {}
): Buffer {
  const workbook = exportToWorkbook(data, columns, options);
  return Buffer.from(
    XLSX.write(workbook, { bookType: "xlsx", type: "array" })
  );
}

export function exportToBase64<T>(
  data: T[],
  columns: ExportColumn<T>[],
  options: ExportOptions = {}
): string {
  const workbook = exportToWorkbook(data, columns, options);
  return XLSX.write(workbook, { bookType: "xlsx", type: "base64" });
}

export function downloadWorkbook(
  workbook: XLSX.WorkBook,
  fileName: string
): void {
  XLSX.writeFile(workbook, fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`);
}

export function exportAndDownload<T>(
  data: T[],
  columns: ExportColumn<T>[],
  options: ExportOptions = {}
): void {
  const workbook = exportToWorkbook(data, columns, options);
  downloadWorkbook(workbook, options.fileName ?? "export.xlsx");
}

export function parseSpreadsheet<T extends Record<string, unknown>>(
  buffer: ArrayBuffer,
  mapRow: (row: Record<string, unknown>) => T | null
): T[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
  return rows.map(mapRow).filter((row): row is T => row !== null);
}
