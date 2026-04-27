import * as XLSX from 'xlsx';
import type { ParsedTable } from './table-parser';
import type { PreparedExportFile } from './messaging';

export type ExportFormat = 'xlsx' | 'csv';

export interface ExportOptions {
  format?: ExportFormat;
  withIndex?: boolean;
}

export function exportToExcel(
  table: ParsedTable,
  options: ExportOptions = {},
): void {
  const { format = 'xlsx', withIndex = false } = options;

  const worksheet = buildWorksheet(table, withIndex);

  const workbook = XLSX.utils.book_new();
  const sheetName = sanitizeSheetName(table.title);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const fileName = `${sanitizeFileName(table.title || table.id)}.${format}`;
  XLSX.writeFile(workbook, fileName, { bookType: format });
}

export function exportMultipleTables(
  tables: ParsedTable[],
  fileName = 'tables-export',
  withIndex = false,
): void {
  const workbook = XLSX.utils.book_new();

  tables.forEach((table, i) => {
    const worksheet = buildWorksheet(table, withIndex);

    let sheetName = sanitizeSheetName(table.title);
    if (sheetName.length > 28) sheetName = sheetName.slice(0, 28);
    sheetName = `${sheetName}_${i + 1}`;

    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  });

  XLSX.writeFile(workbook, `${sanitizeFileName(fileName)}.xlsx`, { bookType: 'xlsx' });
}

export function prepareExportFile(
  table: ParsedTable,
  options: ExportOptions = {},
): PreparedExportFile {
  const { format = 'xlsx', withIndex = false } = options;
  const worksheet = buildWorksheet(table, withIndex);
  const workbook = XLSX.utils.book_new();
  const sheetName = sanitizeSheetName(table.title);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const fileName = `${sanitizeFileName(table.title || table.id)}.${format}`;
  const mimeType =
    format === 'csv'
      ? 'text/csv;charset=utf-8'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const base64 = XLSX.write(workbook, { bookType: format, type: 'base64' });

  return { fileName, mimeType, base64 };
}

export function copyTableToClipboard(
  table: ParsedTable,
  withIndex = false,
): Promise<void> {
  const data = buildSheetData(table, withIndex);
  const text = data.map((row) => row.join('\t')).join('\n');
  return navigator.clipboard.writeText(text);
}

function buildSheetData(table: ParsedTable, withIndex: boolean): string[][] {
  if (!withIndex) {
    return table.headers.length > 0 ? [table.headers, ...table.rows] : table.rows;
  }

  const useCssNumbers =
    table.hasCssRowNumbers && table.cssRowNumbers.length === table.rows.length;

  const headers = ['#', ...table.headers];
  const rows = table.rows.map((row, i) => {
    const num = useCssNumbers ? table.cssRowNumbers[i] : String(i + 1);
    return [num, ...row];
  });

  return table.headers.length > 0 ? [headers, ...rows] : rows;
}

function buildWorksheet(table: ParsedTable, withIndex: boolean): XLSX.WorkSheet {
  const shouldUseParsedData =
    withIndex ||
    table.headers.length > 0 ||
    table.rows.length > 0;

  if (!shouldUseParsedData) {
    const clonedTable = table.element.cloneNode(true) as HTMLTableElement;
    const worksheet = XLSX.utils.table_to_sheet(clonedTable, {
      raw: false,
    });
    autoFitColumns(worksheet, sheetToMatrix(worksheet));
    return worksheet;
  }

  const data = buildSheetData(table, withIndex);
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  applyMerges(worksheet, table, withIndex);
  autoFitColumns(worksheet, data);
  return worksheet;
}

function autoFitColumns(worksheet: XLSX.WorkSheet, data: string[][]): void {
  const colWidths: number[] = [];

  data.forEach((row) => {
    row.forEach((cell, colIndex) => {
      const len = cell ? cell.toString().length : 10;
      if (!colWidths[colIndex] || len > colWidths[colIndex]) {
        colWidths[colIndex] = Math.min(len + 2, 50);
      }
    });
  });

  worksheet['!cols'] = colWidths.map((w) => ({ wch: w }));
}

function applyMerges(
  worksheet: XLSX.WorkSheet,
  table: ParsedTable,
  withIndex: boolean,
): void {
  const headerRowOffset = table.headers.length > 0 ? 1 : 0;
  const colOffset = withIndex ? 1 : 0;

  worksheet['!merges'] = table.merges
    .map((merge) => {
      if (merge.endRow > merge.startRow) {
        return null;
      }

      const isInsideHeader = merge.endRow < headerRowOffset;
      if (isInsideHeader) {
        return null;
      }

      const startRow = merge.startRow - headerRowOffset;
      const endRow = merge.endRow - headerRowOffset;

      if (startRow < 0 || endRow < 0) {
        return null;
      }

      return {
        s: { r: startRow, c: merge.startCol + colOffset },
        e: { r: endRow, c: merge.endCol + colOffset },
      };
    })
    .filter((merge): merge is NonNullable<typeof merge> => merge !== null);
}

function sanitizeSheetName(name: string): string {
  return name.replace(/[\\/*?:\[\]]/g, '_').slice(0, 31);
}

function sanitizeFileName(name: string): string {
  const sanitized = name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return sanitized || 'table_export';
}

function sheetToMatrix(worksheet: XLSX.WorkSheet): string[][] {
  return XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: false,
    defval: '',
    blankrows: true,
  }) as string[][];
}
