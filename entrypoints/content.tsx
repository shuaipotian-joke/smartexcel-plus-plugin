import ReactDOM from 'react-dom/client';
import TableOverlay from '@/components/TableOverlay';
import { detectTables, parseTable } from '@/utils/table-parser';
import { exportToExcel, exportMultipleTables, copyTableToClipboard } from '@/utils/excel-export';
import '@/assets/styles/tailwind.css';

type CreditCheckResult = {
  allowed: boolean;
  remaining?: number;
  isLoggedIn: boolean;
  reason?: string;
  requiredCredits?: number;
};

type ExportAccessResult = CreditCheckResult & { openedFlow?: 'login' | 'payment' };

async function requestCheckAndConsume(amount = 1): Promise<CreditCheckResult> {
  try {
    return await browser.runtime.sendMessage({
      type: 'CHECK_AND_CONSUME',
      payload: { amount },
    });
  } catch {
    return { allowed: false, reason: 'error', isLoggedIn: false };
  }
}

async function ensureExportAccess(amount = 1): Promise<ExportAccessResult> {
  const result = await requestCheckAndConsume(amount);
  if (result.allowed) {
    return result;
  }

  if (result.reason === 'not_logged_in') {
    await browser.runtime.sendMessage({ type: 'OPEN_LOGIN' });
    return { ...result, openedFlow: 'login' };
  }

  await browser.runtime.sendMessage({ type: 'OPEN_PAYMENT_PAGE' });
  return { ...result, openedFlow: 'payment' };
}

function findTableById(
  tables: HTMLTableElement[],
  tableId?: string
): HTMLTableElement | undefined {
  if (!tableId) {
    return tables[0];
  }

  return tables.find((table) => table.dataset.smartexcelTableId === tableId);
}

export default defineContentScript({
  matches: ['https://smarterexcel.com/*'],
  cssInjectionMode: 'ui',

  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: 'smartexcel-overlay',
      position: 'overlay',
      zIndex: 2147483647,
      onMount(container) {
        const wrapper = document.createElement('div');
        container.append(wrapper);
        const root = ReactDOM.createRoot(wrapper);
        root.render(<TableOverlay />);
        return root;
      },
      onRemove(root) {
        root?.unmount();
      },
    });

    ui.mount();

    // Relay postMessage from smartexcel.app pages (e.g. plugin-payment after payment success)
    window.addEventListener('message', (e: MessageEvent) => {
      if (e.data?.type === 'SE_PLUGIN_AUTH' && e.data?.data) {
        browser.runtime.sendMessage({ type: 'PLUGIN_AUTH_SYNC', data: e.data.data });
      }

      if (e.data?.type === 'SE_PLUGIN_SYNC' && e.data?.data) {
        browser.runtime.sendMessage({ type: 'PLUGIN_SYNC', data: e.data.data });
      }

      if (e.data?.type === 'SE_PLUGIN_LOGOUT') {
        browser.runtime.sendMessage({ type: 'CLEAR_PLUGIN_SESSION' });
      }
    });

    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      const tables = detectTables();

      switch (message.type) {
        case 'GET_TABLES': {
          const parsed = tables.map((t) => {
            const p = parseTable(t);
            return {
              id: p.id,
              title: p.title,
              rowCount: p.rowCount,
              colCount: p.colCount,
              headers: p.headers,
              preview: p.rows.slice(0, 3),
            };
          });
          sendResponse(parsed);
          break;
        }

        case 'EXPORT_TABLE': {
          void (async () => {
            const access = await ensureExportAccess(1);
            if (!access.allowed) {
              sendResponse({ ok: false, reason: access.reason });
              return;
            }

            const { format } = message.payload;
            const table = findTableById(tables, message.payload?.tableId);
            if (table) {
              exportToExcel(parseTable(table), { format });
            }
            sendResponse({ ok: true });
          })();
          break;
        }

        case 'EXPORT_ALL': {
          void (async () => {
            const tableCount = tables.length;
            const access = await ensureExportAccess(tableCount);
            if (!access.allowed) {
              sendResponse({
                ok: false,
                reason: access.reason,
                requiredCredits: access.requiredCredits ?? tableCount,
              });
              return;
            }

            const allParsed = tables.map((t) => parseTable(t));
            if (allParsed.length > 0) {
              exportMultipleTables(allParsed, document.title || 'tables-export');
            }
            sendResponse({ ok: true });
          })();
          break;
        }

        case 'COPY_TABLE': {
          void (async () => {
            const access = await ensureExportAccess(1);
            if (!access.allowed) {
              sendResponse({ ok: false, reason: access.reason });
              return;
            }

            const target = findTableById(tables, message.payload?.tableId);
            if (target) {
              await copyTableToClipboard(parseTable(target));
            }
            sendResponse({ ok: true });
          })();
          break;
        }
      }

      return true;
    });
  },
});
