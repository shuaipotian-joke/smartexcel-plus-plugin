const SMARTEXCEL_URL =
  import.meta.env.WXT_SMARTEXCEL_URL || 'http://localhost:3000';
const CONTENT_SCRIPT_PATH = 'content-scripts/content.js';
const CONTEXT_MENU_ROOT_ID = 'smartexcel-context-root';
const CONTEXT_MENU_EXPORT_XLSX_ID = 'smartexcel-context-export-xlsx';
const CONTEXT_MENU_EXPORT_CSV_ID = 'smartexcel-context-export-csv';
type ContextMenuState = {
  tableId: string | null;
  frameId?: number;
  isHeaderContext: boolean;
};
type PendingContextExport = {
  tabId: number;
  frameId?: number;
  tableId: string;
  format: 'xlsx' | 'csv';
};

type PreparedExportResponse = {
  ok: boolean;
  reason?: string;
  file?: {
    fileName: string;
    mimeType: string;
    base64: string;
  };
};

function buildWebsiteRedirectPath(tableId?: string) {
  if (tableId) {
    return `/import?source=extension&tableId=${encodeURIComponent(tableId)}`;
  }

  return '/dashboard';
}

async function refreshPluginState() {
  return {
    isFree: true,
  };
}

function canInjectIntoUrl(url?: string) {
  if (!url) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

async function ensureContentScript(tabId: number) {
  try {
    await browser.tabs.sendMessage(tabId, { type: 'GET_TABLES' });
    return true;
  } catch {
    // Inject on demand below.
  }

  const tab = await browser.tabs.get(tabId);
  if (!canInjectIntoUrl(tab.url)) {
    return false;
  }

  await browser.scripting.executeScript({
    target: { tabId, allFrames: true },
    files: [CONTENT_SCRIPT_PATH],
  });

  return true;
}

const contextStateByTabId = new Map<number, ContextMenuState>();
let pendingContextExport: PendingContextExport | null = null;

function createContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ROOT_ID,
      title: 'SmartExcel 导出',
      contexts: ['page'],
      documentUrlPatterns: ['http://*/*', 'https://*/*'],
    });

    chrome.contextMenus.create({
      id: CONTEXT_MENU_EXPORT_XLSX_ID,
      parentId: CONTEXT_MENU_ROOT_ID,
      title: '导出 Excel',
      contexts: ['page'],
      documentUrlPatterns: ['http://*/*', 'https://*/*'],
    });

    chrome.contextMenus.create({
      id: CONTEXT_MENU_EXPORT_CSV_ID,
      parentId: CONTEXT_MENU_ROOT_ID,
      title: '导出 CSV',
      contexts: ['page'],
      documentUrlPatterns: ['http://*/*', 'https://*/*'],
    });
  });
}

function updateContextMenuVisibility(state?: ContextMenuState) {
  void state;
}

async function dispatchContextExport(
  tabId: number,
  tableId: string,
  format: 'xlsx' | 'csv',
  frameId?: number,
): Promise<void> {
  const isReady = await ensureContentScript(tabId);
  if (!isReady) {
    return;
  }

  await browser.tabs.sendMessage(
    tabId,
    {
      type: 'EXPORT_CONTEXT_TABLE',
      payload: { tableId, format },
    },
    frameId != null ? { frameId } : undefined,
  );
}

async function prepareContextExportFile(
  tabId: number,
  tableId: string,
  format: 'xlsx' | 'csv',
  frameId?: number,
): Promise<NonNullable<PreparedExportResponse['file']>> {
  const isReady = await ensureContentScript(tabId);
  if (!isReady) {
    throw new Error('content_script_unavailable');
  }

  const response = (await browser.tabs.sendMessage(
    tabId,
    {
      type: 'PREPARE_CONTEXT_EXPORT',
      payload: { tableId, format },
    },
    frameId != null ? { frameId } : undefined,
  )) as PreparedExportResponse | undefined;

  if (!response?.ok || !response.file) {
    throw new Error(response?.reason ?? 'prepare_context_export_failed');
  }

  return response.file;
}

async function downloadPreparedContextExport(
  file: NonNullable<PreparedExportResponse['file']>,
): Promise<void> {
  const dataUrl = `data:${file.mimeType};base64,${file.base64}`;
  await browser.downloads.download({
    url: dataUrl,
    filename: file.fileName,
    saveAs: false,
  });
}

async function notifyContextExportFeedback(
  tabId: number,
  format: 'xlsx' | 'csv',
  remaining?: number,
  frameId?: number,
): Promise<void> {
  try {
    await browser.tabs.sendMessage(
      tabId,
      {
        type: 'SHOW_EXPORT_FEEDBACK',
        payload: {
          format,
          remaining,
          used: 1,
        },
      },
      frameId != null ? { frameId } : undefined,
    );
  } catch (error) {
    console.warn('show export feedback failed:', error);
  }
}

async function notifyContextExportProgress(
  tabId: number,
  frameId?: number,
): Promise<void> {
  try {
    await browser.tabs.sendMessage(
      tabId,
      {
        type: 'SHOW_EXPORT_PROGRESS',
        payload: {},
      },
      frameId != null ? { frameId } : undefined,
    );
  } catch (error) {
    console.warn('show export progress failed:', error);
  }
}

async function continuePendingContextExport(
  pending: PendingContextExport,
): Promise<number | undefined> {
  const preparedFile = await prepareContextExportFile(
    pending.tabId,
    pending.tableId,
    pending.format,
    pending.frameId,
  );

  await downloadPreparedContextExport(preparedFile);
  return undefined;
}

// ─── Main background entry ─────────────────────────────────────────────────

export default defineBackground(() => {
  createContextMenus();

  browser.runtime.onInstalled.addListener(() => {
    createContextMenus();
  });

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'SET_CONTEXT_TABLE') {
      if (_sender.tab?.id != null) {
        const state: ContextMenuState = {
          tableId: message.payload?.tableId ?? null,
          frameId: _sender.frameId,
          isHeaderContext: Boolean(message.payload?.isHeaderContext),
        };
        contextStateByTabId.set(_sender.tab.id, state);
        updateContextMenuVisibility(state);
      }
      sendResponse({ ok: true });
      return false;
    }

    if (message.type === 'OPEN_WEBSITE') {
      const redirectTo = buildWebsiteRedirectPath(message.payload?.tableId);
      const targetUrl = message.payload?.tableId
        ? `${SMARTEXCEL_URL}${redirectTo}`
        : SMARTEXCEL_URL;

      browser.tabs
        .create({ url: targetUrl })
        .then(() => sendResponse({ ok: true }))
        .catch((error) => {
          console.error('open website failed:', error);
          sendResponse({ ok: false });
        });
      return true;
    }

    if (message.type === 'GET_STATE') {
      refreshPluginState().then((state) => {
        sendResponse(state);
      });
      return true;
    }

    return false;
  });

  browser.action.onClicked.addListener(async (tab) => {
    if (tab.id) {
      const isReady = await ensureContentScript(tab.id);
      if (!isReady) {
        return;
      }

      await browser.tabs.sendMessage(tab.id, { type: 'TOGGLE_PANEL' });
    }
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    contextStateByTabId.delete(tabId);
    if (pendingContextExport?.tabId === tabId) {
      pendingContextExport = null;
    }
  });

  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!tab?.id) {
      return;
    }

    if (
      info.menuItemId !== CONTEXT_MENU_EXPORT_XLSX_ID &&
      info.menuItemId !== CONTEXT_MENU_EXPORT_CSV_ID
    ) {
      return;
    }

    const isReady = await ensureContentScript(tab.id);
    if (!isReady) {
      return;
    }

    const format = info.menuItemId === CONTEXT_MENU_EXPORT_CSV_ID ? 'csv' : 'xlsx';
    const contextState = contextStateByTabId.get(tab.id);
    const tableId = contextState?.tableId ?? null;
    const frameId = contextState?.frameId;

    if (!tableId || !contextState?.isHeaderContext) {
      return;
    }

    try {
      pendingContextExport = {
        tabId: tab.id,
        frameId,
        tableId,
        format,
      };
      await notifyContextExportProgress(tab.id, frameId);
      const remaining = await continuePendingContextExport(pendingContextExport);
      if (remaining !== undefined) {
        await notifyContextExportFeedback(tab.id, format, remaining, frameId);
      }
      updateContextMenuVisibility(undefined);
    } catch (error) {
      console.error('context menu export failed:', error);
    }
  });
});
