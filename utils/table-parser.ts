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

export interface LogicalTableBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export function detectTables(): HTMLTableElement[] {
  const meaningfulTables = Array.from(document.querySelectorAll('table'))
    .filter(isMeaningfulTable)
    .filter((table) => !isFixedReplicaTable(table))
    .filter((table) => !isSplitHeaderTable(table));

  return meaningfulTables
    .map((table, index) => {
      if (!table.dataset.smartexcelTableId) {
        table.dataset.smartexcelTableId = `table-${index + 1}`;
      }
      return table;
    });
}

export function parseTable(table: HTMLTableElement): ParsedTable {
  ensureStableTableId(table);
  const rows: string[][] = [];
  const dataRowElements: Element[] = [];
  const parsedGrid = buildParsedGrid(table);
  const headers = resolveHeaders(table, parsedGrid);
  const merges = parsedGrid.merges;
  const colCount = Math.max(parsedGrid.colCount, headers.length);

  parsedGrid.normalizedGrid.forEach((rowData, index) => {
    if (index < parsedGrid.headerRowCount) {
      return;
    }

    if (rowData.length > 0 && rowData.some((cell) => cell.trim() !== '')) {
      rows.push(rowData);
      if (parsedGrid.tableRows[index]) {
        dataRowElements.push(parsedGrid.tableRows[index]);
      }
    }
  });

  const caption = table.querySelector('caption');
  const ariaLabel = table.getAttribute('aria-label');
  const title =
    caption?.textContent?.trim() ||
    ariaLabel ||
    findNearbyHeading(table) ||
    sanitizeDocumentTitle(document.title) ||
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

export function getLogicalTable(table: HTMLTableElement): HTMLTableElement {
  return findPrimaryTable(table) ?? findLinkedBodyTable(table) ?? table;
}

export function getLogicalTableBounds(table: HTMLTableElement): LogicalTableBounds {
  const logicalTable = getLogicalTable(table);
  const headerTable = findLinkedHeaderTable(logicalTable, buildParsedGrid(logicalTable).colCount);

  const rects = [logicalTable.getBoundingClientRect()];
  if (headerTable) {
    rects.push(headerTable.getBoundingClientRect());
  }

  const left = Math.min(...rects.map((rect) => rect.left));
  const top = Math.min(...rects.map((rect) => rect.top));
  const right = Math.max(...rects.map((rect) => rect.right));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));

  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

function buildParsedGrid(table: HTMLTableElement) {
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
          grid[targetRow][targetCol] = colOffset === 0 ? cellText : '';
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

  return {
    merges,
    tableRows,
    normalizedGrid,
    headerRowCount,
    colCount,
  };
}

function resolveHeaders(
  table: HTMLTableElement,
  parsedGrid: ReturnType<typeof buildParsedGrid>
): string[] {
  if (parsedGrid.headerRowCount > 0) {
    return [...(parsedGrid.normalizedGrid[parsedGrid.headerRowCount - 1] ?? [])];
  }

  const headerTable = findLinkedHeaderTable(table, parsedGrid.colCount);
  if (!headerTable) {
    return [];
  }

  const headerGrid = buildParsedGrid(headerTable);
  const fallbackHeaders =
    headerGrid.normalizedGrid[headerGrid.headerRowCount - 1] ??
    headerGrid.normalizedGrid[headerGrid.normalizedGrid.length - 1] ??
    [];

  return [...fallbackHeaders];
}

function findLinkedHeaderTable(
  table: HTMLTableElement,
  targetColCount: number
): HTMLTableElement | null {
  const primaryTable = findPrimaryTable(table);
  const tableRoot = getElTableRoot(primaryTable ?? table);
  const primaryHeader = tableRoot?.querySelector(
    ':scope > .el-table__header-wrapper table.el-table__header'
  ) as HTMLTableElement | null;
  if (primaryHeader && primaryHeader !== table) {
    return primaryHeader;
  }

  const allTables = Array.from(document.querySelectorAll('table'));
  const currentIndex = allTables.indexOf(table);
  const currentRect = table.getBoundingClientRect();

  for (let index = currentIndex - 1; index >= 0 && index >= currentIndex - 4; index -= 1) {
    const candidate = allTables[index];
    if (!candidate) {
      continue;
    }

    const candidateGrid = buildParsedGrid(candidate);
    const candidateHasHeaders =
      candidate.querySelector('thead') != null ||
      candidate.querySelector('th') != null;
    const candidateDataRows =
      candidateGrid.normalizedGrid.length - candidateGrid.headerRowCount;

    if (!candidateHasHeaders || candidateDataRows > 1 || candidateGrid.colCount === 0) {
      continue;
    }

    if (targetColCount > 0 && Math.abs(candidateGrid.colCount - targetColCount) > 2) {
      continue;
    }

    const candidateRect = candidate.getBoundingClientRect();
    const isNearby =
      Math.abs(candidateRect.left - currentRect.left) < 40 &&
      Math.abs(candidateRect.width - currentRect.width) < 80;

    if (isNearby) {
      return candidate;
    }
  }

  return null;
}

function findLinkedBodyTable(table: HTMLTableElement): HTMLTableElement | null {
  const primaryTable = findPrimaryTable(table);
  if (primaryTable && primaryTable !== table) {
    return primaryTable;
  }

  const parsedGrid = buildParsedGrid(table);
  const hasHeaders = table.querySelector('thead, th') != null;
  const dataRowCount = parsedGrid.normalizedGrid.length - parsedGrid.headerRowCount;

  if (!hasHeaders || dataRowCount > 1) {
    return null;
  }

  const allTables = Array.from(document.querySelectorAll('table'));
  const currentIndex = allTables.indexOf(table);
  const currentRect = table.getBoundingClientRect();

  for (let index = currentIndex + 1; index < allTables.length && index <= currentIndex + 4; index += 1) {
    const candidate = allTables[index];
    if (!candidate || !isMeaningfulTable(candidate)) {
      continue;
    }

    const candidateGrid = buildParsedGrid(candidate);
    const candidateHasOwnHeaders = candidate.querySelector('thead') != null;
    const candidateRect = candidate.getBoundingClientRect();
    const isNearby =
      Math.abs(candidateRect.left - currentRect.left) < 40 &&
      Math.abs(candidateRect.width - currentRect.width) < 80;

    if (candidateHasOwnHeaders || !isNearby) {
      continue;
    }

    if (candidateGrid.colCount > 0 && Math.abs(candidateGrid.colCount - parsedGrid.colCount) <= 2) {
      return candidate;
    }
  }

  return null;
}

function findPrimaryTable(table: HTMLTableElement): HTMLTableElement | null {
  const tableRoot = getElTableRoot(table);
  if (!tableRoot) {
    return null;
  }

  const mainBody = tableRoot.querySelector(
    ':scope > .el-table__body-wrapper table.el-table__body'
  ) as HTMLTableElement | null;

  if (mainBody) {
    return mainBody;
  }

  const mainHeader = tableRoot.querySelector(
    ':scope > .el-table__header-wrapper table.el-table__header'
  ) as HTMLTableElement | null;

  return mainHeader;
}

function getElTableRoot(table: HTMLTableElement): HTMLElement | null {
  return table.closest('.el-table');
}

function isFixedReplicaTable(table: HTMLTableElement): boolean {
  return Boolean(table.closest('.el-table__fixed, .el-table__fixed-right'));
}

function isSplitHeaderTable(table: HTMLTableElement): boolean {
  return findLinkedBodyTable(table) != null;
}

function isMeaningfulTable(table: HTMLTableElement): boolean {
  const rows = Array.from(table.querySelectorAll('tr'));
  if (rows.length === 0) {
    return false;
  }

  const rect = table.getBoundingClientRect();
  if (rect.width < 120 || rect.height < 40) {
    return false;
  }

  const parsedGrid = buildParsedGrid(table);
  const nonEmptyRows = parsedGrid.normalizedGrid.filter((row) =>
    row.some((cell) => cell.trim() !== '')
  );
  const hasHeaders = table.querySelector('thead, th') != null;
  const hasEnoughData = nonEmptyRows.length >= 2 && parsedGrid.colCount >= 2;

  if (!hasHeaders && !hasEnoughData) {
    return false;
  }

  const joinedText = nonEmptyRows
    .flat()
    .join(' ')
    .trim();

  if (!joinedText) {
    return false;
  }

  const interactiveCount = table.querySelectorAll(
    'button, input, select, textarea, a'
  ).length;

  return interactiveCount < Math.max(8, rows.length * 2);
}

function ensureStableTableId(table: HTMLTableElement): void {
  if (table.dataset.smartexcelTableId) {
    return;
  }

  const allTables = Array.from(document.querySelectorAll('table'));
  const index = allTables.indexOf(table);
  table.dataset.smartexcelTableId = `table-${index >= 0 ? index + 1 : 'unknown'}`;
}

function findNearbyHeading(table: HTMLTableElement): string {
  const candidates = [
    table.closest('section')?.querySelector('h1, h2, h3, h4, h5, h6'),
    document.querySelector('.mw-page-title-main'),
    document.querySelector('h1'),
  ];

  for (const candidate of candidates) {
    const text = candidate?.textContent?.trim();
    if (text) {
      return text;
    }
  }

  let node: Element | null = table;
  while (node) {
    let sibling = node.previousElementSibling;
    while (sibling) {
      if (/^H[1-6]$/.test(sibling.tagName)) {
        const text = sibling.textContent?.trim();
        if (text) {
          return text;
        }
      }
      sibling = sibling.previousElementSibling;
    }
    node = node.parentElement;
  }

  return '';
}

function sanitizeDocumentTitle(title: string): string {
  return title
    .replace(/\s*[-|·•]\s*.+$/, '')
    .trim();
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
