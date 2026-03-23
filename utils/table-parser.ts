export interface ParsedTable {
  id: string;
  title: string;
  headers: string[];
  rows: string[][];
  merges: Array<{
    startRow: number;
    endRow: number;
    startCol: number;
    endCol: number;
  }>;
  element: HTMLTableElement;
  rowCount: number;
  colCount: number;
  hasCssRowNumbers: boolean;
  cssRowNumbers: string[];
}

export function detectTables(): HTMLTableElement[] {
  return Array.from(document.querySelectorAll('table'))
    .filter((table) => {
      const rows = table.querySelectorAll('tr');
      return rows.length > 0;
    })
    .map((table, index) => {
      if (!table.dataset.smartexcelTableId) {
        table.dataset.smartexcelTableId = `table-${index + 1}`;
      }
      return table;
    });
}

export function parseTable(table: HTMLTableElement): ParsedTable {
  const headers: string[] = [];
  const rows: string[][] = [];
  const dataRowElements: Element[] = [];
  const merges: ParsedTable['merges'] = [];

  const tableRows = Array.from(table.querySelectorAll('tr'));
  const grid: string[][] = [];
  const occupancy: boolean[][] = [];

  const thead = table.querySelector('thead');
  tableRows.forEach((row, rowIndex) => {
    const cells = Array.from(row.querySelectorAll(':scope > th, :scope > td'));
    if (cells.length === 0) {
      return;
    }

    if (!grid[rowIndex]) {
      grid[rowIndex] = [];
    }

    let colIndex = 0;
    cells.forEach((cell) => {
      while (occupancy[rowIndex]?.[colIndex]) {
        colIndex += 1;
      }

      const cellText = getCellText(cell as HTMLElement);
      const colspan = Math.max(1, Number.parseInt(cell.getAttribute('colspan') || '1', 10) || 1);
      const rowspan = Math.max(1, Number.parseInt(cell.getAttribute('rowspan') || '1', 10) || 1);

      for (let rowOffset = 0; rowOffset < rowspan; rowOffset += 1) {
        const targetRow = rowIndex + rowOffset;
        if (!grid[targetRow]) {
          grid[targetRow] = [];
        }
        if (!occupancy[targetRow]) {
          occupancy[targetRow] = [];
        }

        for (let colOffset = 0; colOffset < colspan; colOffset += 1) {
          const targetCol = colIndex + colOffset;
          occupancy[targetRow][targetCol] = true;
          grid[targetRow][targetCol] =
            rowOffset === 0 && colOffset === 0 ? cellText : '';
        }
      }

      if (rowspan > 1 || colspan > 1) {
        merges.push({
          startRow: rowIndex,
          endRow: rowIndex + rowspan - 1,
          startCol: colIndex,
          endCol: colIndex + colspan - 1,
        });
      }

      colIndex += colspan;
    });
  });

  const colCount = grid.reduce((max, row) => Math.max(max, row.length), 0);
  const normalizedGrid = grid.map((row) =>
    Array.from({ length: colCount }, (_, index) => row[index] ?? '')
  );

  const headerRowCount = thead
    ? thead.querySelectorAll('tr').length
    : normalizedGrid.length > 0 && tableRows[0]?.querySelector('th') !== null
      ? 1
      : 0;

  if (headerRowCount > 0) {
    const headerRow = normalizedGrid[headerRowCount - 1] ?? [];
    headers.push(...headerRow);
  }

  normalizedGrid.forEach((rowData, index) => {
    if (index < headerRowCount) {
      return;
    }

    if (rowData.length > 0 && rowData.some((cell) => cell.trim() !== '')) {
      rows.push(rowData);
      if (tableRows[index]) {
        dataRowElements.push(tableRows[index]);
      }
    }
  });

  const caption = table.querySelector('caption');
  const ariaLabel = table.getAttribute('aria-label');
  const title =
    caption?.textContent?.trim() ||
    ariaLabel ||
    `Table ${table.dataset.smartexcelTableId ?? 'unknown'}`;

  const hasCssRowNumbers = detectCssRowNumbers(table);
  const cssRowNumbers = hasCssRowNumbers
    ? extractCssRowNumbers(dataRowElements)
    : [];

  return {
    id: table.dataset.smartexcelTableId ?? 'table-unknown',
    title,
    headers,
    rows,
    merges,
    element: table,
    rowCount: rows.length,
    colCount,
    hasCssRowNumbers,
    cssRowNumbers,
  };
}

function detectCssRowNumbers(table: HTMLTableElement): boolean {
  if (table.className.includes('row-number')) return true;

  const testRow =
    table.querySelector('tbody tr') ??
    table.querySelector('tr:nth-child(2)');
  if (!testRow) return false;

  try {
    const style = window.getComputedStyle(testRow, '::before');
    const content = style.getPropertyValue('content');
    if (content && content !== 'none' && content !== 'normal' && content !== '""' && content !== "''") {
      const display = style.getPropertyValue('display');
      return display !== 'none';
    }
  } catch {}

  return false;
}

function extractCssRowNumbers(rowElements: Element[]): string[] {
  const results: string[] = [];
  let rank = 0;

  for (const row of rowElements) {
    const el = row as HTMLElement;
    const hasRank = rowHasVisibleBefore(el) && !isNoRankRow(el);

    if (hasRank) {
      rank++;
      results.push(String(rank));
    } else {
      results.push('');
    }
  }

  return results;
}

function rowHasVisibleBefore(el: HTMLElement): boolean {
  try {
    const style = window.getComputedStyle(el, '::before');
    const content = style.getPropertyValue('content');
    const display = style.getPropertyValue('display');

    if (display === 'none') return false;
    if (!content || content === 'none' || content === 'normal') return false;
    if (content === '""' || content === "''") return false;

    return true;
  } catch {
    return false;
  }
}

function isNoRankRow(el: HTMLElement): boolean {
  const cl = el.className.toLowerCase();
  return cl.includes('norank') || cl.includes('no-rank') || cl.includes('header');
}

function getCellText(cell: HTMLElement): string {
  const cloned = cell.cloneNode(true) as HTMLElement;
  cloned.querySelectorAll('script, style, .mw-collapsible-content').forEach((el) => el.remove());
  return cloned.textContent?.trim().replace(/\s+/g, ' ') ?? '';
}
