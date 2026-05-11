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

async function clearPluginSession() {
  await browser.storage.local.remove([
    'se_plugin_token',
    'se_plugin_token_expires_at',
    'se_logged_in',
    'se_credits',
    'se_email',
    'se_name',
    'se_user_id',
  ]);
}

async function refreshPluginState() {
  return {
    loggedIn: true,
    credits: Infinity,
    email: '',
    name: '',
    userId: '',
    tokenExpiresAt: '',
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

/**
 * Free edition: always allow export without login or credit checks.
 */
async function checkAndConsume(amount = 1): Promise<{
  allowed: boolean;
  remaining?: number;
  isLoggedIn: boolean;
  reason?: string;
  requiredCredits?: number;
}> {
  void amount;
  return { allowed: true, isLoggedIn: true };
}

async function syncCredits(data: {
  credits: number;
  loggedIn: boolean;
  email?: string;
  name?: string;
}): Promise<void> {
  await browser.storage.local.set({
    se_credits: data.credits,
    se_logged_in: data.loggedIn,
    se_email: data.email ?? '',
    se_name: data.name ?? '',
  });
}

async function syncPluginAuth(data: {
  token: string;
  expiresAt: string;
  credits: number;
  userId: string;
  email?: string;
  name?: string;
}): Promise<void> {
  void data;
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
      payload: { tableId, format, skipAccessCheck: true },
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

  const access = await checkAndConsume(1);

  if (!access.allowed) {
    return undefined;
  }

  await downloadPreparedContextExport(preparedFile);
  return access.remaining;
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

    if (message.type === 'OPEN_LOGIN') {
      sendResponse({ ok: true });
      return false;
    }

    if (message.type === 'OPEN_REGISTER') {
      sendResponse({ ok: true });
      return false;
    }

    if (message.type === 'OPEN_PAYMENT_PAGE') {
      sendResponse({ ok: true });
      return false;
    }

    // Check and consume one export credit (async)
    if (message.type === 'CHECK_AND_CONSUME') {
      checkAndConsume(message.payload?.amount).then(sendResponse);
      return true; // keep channel open for async response
    }

    // Sync credits from website payment pages via postMessage relay
    if (message.type === 'PLUGIN_SYNC') {
      syncCredits(message.data).then(() => sendResponse({ ok: true }));
      return true;
    }

    if (message.type === 'PLUGIN_AUTH_SYNC') {
      syncPluginAuth(message.data).then(() => sendResponse({ ok: true }));
      return true;
    }

    if (message.type === 'LOGOUT_PLUGIN') {
      clearPluginSession()
        .then(() => sendResponse({ ok: true }))
        .catch((error) => {
          console.error('logout plugin failed:', error);
          sendResponse({ ok: false });
        });
      return true;
    }

    if (message.type === 'CLEAR_PLUGIN_SESSION') {
      clearPluginSession()
        .then(() => sendResponse({ ok: true }))
        .catch((error) => {
          console.error('clear plugin session failed:', error);
          sendResponse({ ok: false });
        });
      return true;
    }

    // Get current credit state (for popup display)
    if (message.type === 'GET_STATE') {
      refreshPluginState().then(async (state) => {
        sendResponse({ ...state, freeUsed: 0, freeLimit: 0 });
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
