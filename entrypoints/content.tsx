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
};

async function requestCheckAndConsume(): Promise<CreditCheckResult> {
  try {
    return await browser.runtime.sendMessage({ type: 'CHECK_AND_CONSUME' });
  } catch {
    return { allowed: false, reason: 'error', isLoggedIn: false };
  }
}

async function ensureExportAccess() {
  const result = await requestCheckAndConsume();
  if (result.allowed) {
    return true;
  }

  if (result.reason === 'not_logged_in') {
    await browser.runtime.sendMessage({ type: 'OPEN_LOGIN' });
    return false;
  }

  await browser.runtime.sendMessage({ type: 'OPEN_PAYMENT_PAGE' });
  return false;
}

export default defineContentScript({
  matches: ['<all_urls>'],
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
            const allowed = await ensureExportAccess();
            if (!allowed) {
              sendResponse({ ok: false });
              return;
            }

            const { format } = message.payload;
            const table = tables[0];
            if (table) {
              exportToExcel(parseTable(table), format);
            }
            sendResponse({ ok: true });
          })();
          break;
        }

        case 'EXPORT_ALL': {
          void (async () => {
            const allowed = await ensureExportAccess();
            if (!allowed) {
              sendResponse({ ok: false });
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
            const allowed = await ensureExportAccess();
            if (!allowed) {
              sendResponse({ ok: false });
              return;
            }

            const target = tables[0];
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
