import { useState, useEffect, useCallback } from 'react';
import type { TableInfo } from '@/utils/messaging';
import { useExtensionStore } from '@/utils/store';
import { t, type Lang } from '@/utils/i18n';
import { ensureContentScript } from '@/utils/ensure-content-script';
import {
  FileSpreadsheet,
  Loader2,
  Settings,
  Sparkles,
  Table2,
} from 'lucide-react';
import SettingsPanel from './SettingsPanel';

type CreditState = {
  credits: number;
  loggedIn: boolean;
  freeUsed: number;
  freeLimit: number;
  email?: string;
  name?: string;
};

export default function App() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [creditState, setCreditState] = useState<CreditState | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [actionMessage, setActionMessage] = useState<{
    text: string;
    showBuy: boolean;
  } | null>(null);

  const lang = useExtensionStore((s) => s.lang);
  const setLang = useExtensionStore((s) => s.setLang);
  const initLang = useExtensionStore((s) => s.initLang);

  useEffect(() => {
    initLang();
    loadTables();
    loadCreditState();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleStorageChange = (
      changes: Record<string, { newValue?: unknown }>
    ) => {
      if (
        changes.se_credits ||
        changes.se_logged_in ||
        changes.se_email ||
        changes.se_name ||
        changes.se_plugin_token
      ) {
        void loadCreditState();
      }
    };

    browser.storage.onChanged.addListener(handleStorageChange);
    return () => browser.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  async function loadTables() {
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab.id) {
        const isReady = await ensureContentScript(tab.id);
        if (!isReady) {
          setTables([]);
          return;
        }

        const result = await browser.tabs.sendMessage(tab.id, { type: 'GET_TABLES' });
        setTables(result ?? []);
      }
    } catch {
      setTables([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadCreditState() {
    try {
      const state = await browser.runtime.sendMessage({ type: 'GET_STATE' });
      setCreditState(state);
    } catch {
      // ignore
    }
  }

  const handleExportAll = useCallback(async () => {
    if (tables.length === 0) {
      return;
    }

    setActionMessage(null);

    if (!creditState?.loggedIn) {
      await browser.runtime.sendMessage({ type: 'OPEN_LOGIN' });
      return;
    }

    const requiredCredits = tables.length;
    const confirmed = window.confirm(
      t('confirmExportAll', lang, {
        count: tables.length,
        credits: requiredCredits,
      }),
    );

    if (!confirmed) {
      return;
    }

    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab.id) {
      const isReady = await ensureContentScript(tab.id);
      if (!isReady) {
        setTables([]);
        return;
      }

      const result = await browser.tabs.sendMessage(tab.id, { type: 'EXPORT_ALL' });
      if (!result?.ok && result?.reason === 'no_credits') {
        setActionMessage({
          text: t('insufficientCreditsForAll', lang, {
            credits: result.requiredCredits ?? requiredCredits,
          }),
          showBuy: true,
        });
      }
    }
  }, [creditState?.loggedIn, lang, tables.length]);

  const handleAddCredits = useCallback(() => {
    browser.runtime.sendMessage({ type: 'OPEN_PAYMENT_PAGE' });
  }, []);

  const handleLogin = useCallback(async () => {
    await browser.runtime.sendMessage({ type: 'OPEN_LOGIN' });
  }, []);

  const handleRegister = useCallback(async () => {
    await browser.runtime.sendMessage({ type: 'OPEN_REGISTER' });
  }, []);

  const handleLogout = useCallback(async () => {
    await browser.runtime.sendMessage({ type: 'LOGOUT_PLUGIN' });
    await loadCreditState();
  }, []);

  const getRemainingText = () => {
    if (!creditState) return '';
    if (creditState.loggedIn) {
      return t('creditsRemaining', lang, { n: creditState.credits });
    }
    return t('signupBonusHint', lang, { n: creditState.freeLimit });
  };

  if (showSettings) {
    return (
      <SettingsPanel
        lang={lang}
        onLangChange={setLang}
        onBack={() => setShowSettings(false)}
        creditState={creditState}
        onLogin={handleLogin}
        onRegister={handleRegister}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="w-[380px] min-h-[260px] overflow-hidden bg-cream-50 text-[#173127]">
      {/* Header */}
      <div className="relative border-b border-cream-200 bg-[radial-gradient(circle_at_top_left,rgba(42,179,127,0.18),transparent_36%),linear-gradient(135deg,#fffdf7_0%,#f1fbf6_100%)] px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/80 bg-white/85 shadow-soft">
            <img src="/icon-128.png" alt="" className="h-7 w-7 rounded-lg" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-semibold tracking-tight text-[#173127]">
              SmartExcel
            </h1>
            <p className="mt-0.5 text-xs text-[#557064]">{t('appSubtitle', lang)}</p>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#d9e7d8] bg-white/80 text-[#557064] shadow-sm transition-all hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
            title={t('settings', lang)}
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Credit info bar */}
      {creditState && (
        <div className="mx-4 mt-4 flex items-center justify-between rounded-xl border border-brand-100 bg-white/80 px-3 py-2.5 shadow-soft">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <span className="truncate text-xs font-medium text-[#305246]">
              {getRemainingText()}
            </span>
          </div>
          <button
            className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-brand-700"
            onClick={creditState.loggedIn ? handleAddCredits : handleLogin}
          >
            {creditState.loggedIn ? t('addCredits', lang) : t('login', lang)}
          </button>
        </div>
      )}

      {actionMessage && (
        <div className="mx-4 mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 shadow-sm">
          <span>{actionMessage.text}</span>{' '}
          {actionMessage.showBuy && (
            <button
              className="font-medium underline underline-offset-2"
              onClick={handleAddCredits}
            >
              {t('clickToBuyCredits', lang)}
            </button>
          )}
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
          </div>
        ) : tables.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#d9e7d8] bg-white/70 px-5 py-9 text-center shadow-soft">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
              <Table2 className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-[#305246]">{t('noTablesFound', lang)}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-[#6d8277]">{t('hoverHint', lang)}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-[#305246]">
                {t('tablesDetected', lang, { n: tables.length })}
              </span>
              {tables.length > 1 && (
                <button
                  className="rounded-lg border border-brand-100 bg-white px-3 py-1.5 text-xs font-medium text-brand-700 transition-colors hover:bg-brand-50"
                  onClick={handleExportAll}
                >
                  {t('exportAll', lang)}
                </button>
              )}
            </div>
            {tables.map((table) => (
              <TableCard key={table.id} table={table} lang={lang} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TableCard({ table, lang }: { table: TableInfo; lang: Lang }) {
  const handleExport = useCallback(
    async (format: 'xlsx' | 'csv') => {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab.id) {
        const isReady = await ensureContentScript(tab.id);
        if (!isReady) {
          return;
        }

        browser.tabs.sendMessage(tab.id, {
          type: 'EXPORT_TABLE',
          payload: { tableId: table.id, format },
        });
      }
    },
    [table.id],
  );

  return (
    <div className="group rounded-xl border border-[#e5eadf] bg-white/85 p-3 shadow-soft transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:bg-white hover:shadow-lift">
      <div className="flex items-center justify-between mb-2">
        <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-[#173127]">
          <FileSpreadsheet className="h-4 w-4 shrink-0 text-brand-600" />
          <span className="truncate max-w-[190px]">{table.title}</span>
        </span>
        <span className="rounded-md bg-cream-100 px-2 py-0.5 text-xs text-[#6d8277]">
          {table.rowCount}×{table.colCount}
        </span>
      </div>

      {table.headers.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {table.headers.slice(0, 4).map((h, i) => (
            <span key={i} className="rounded-md bg-brand-50 px-2 py-0.5 text-[10px] text-[#557064]">
              {h.length > 10 ? h.slice(0, 10) + '…' : h}
            </span>
          ))}
          {table.headers.length > 4 && (
            <span className="text-[10px] text-[#8a9a92]">+{table.headers.length - 4}</span>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => handleExport('xlsx')}
          className="flex-1 rounded-lg bg-brand-600 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-brand-700"
        >
          {t('exportExcel', lang)}
        </button>
        <button
          onClick={() => handleExport('csv')}
          className="rounded-lg border border-[#d9e7d8] px-3 py-1.5 text-xs text-[#557064] transition-colors hover:bg-brand-50 hover:text-brand-700"
        >
          {t('csvLabel', lang)}
        </button>
      </div>
    </div>
  );
}
