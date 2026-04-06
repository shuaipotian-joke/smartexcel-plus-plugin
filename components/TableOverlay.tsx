import { useState, useEffect, useCallback, useRef } from 'react';
import { parseTable, type ParsedTable } from '@/utils/table-parser';
import { exportToExcel } from '@/utils/excel-export';
import { useExtensionStore } from '@/utils/store';
import { t, type Lang } from '@/utils/i18n';

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
    // Fallback if background not available
    return { allowed: false, reason: 'error', isLoggedIn: false };
  }
}

function openLoginPage() {
  browser.runtime.sendMessage({ type: 'OPEN_LOGIN' });
}

function openPaymentPage() {
  browser.runtime.sendMessage({ type: 'OPEN_PAYMENT_PAGE' });
}

interface FloatingButton {
  visible: boolean;
  x: number;
  y: number;
  table: ParsedTable | null;
}

export default function TableOverlay() {
  const isEnabled = useExtensionStore((s) => s.isEnabled);
  const lang = useExtensionStore((s) => s.lang);
  const [fab, setFab] = useState<FloatingButton>({
    visible: false,
    x: 0,
    y: 0,
    table: null,
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState('');
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const fabRef = useRef<HTMLDivElement>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  }, []);

  // Load saved lang preference and watch for changes made in the popup
  useEffect(() => {
    useExtensionStore.getState().initLang();
    const handler = (changes: Record<string, { newValue?: unknown }>) => {
      if (changes.se_lang?.newValue) {
        useExtensionStore.setState({ lang: changes.se_lang.newValue as Lang });
      }
    };
    browser.storage.onChanged.addListener(handler);
    return () => browser.storage.onChanged.removeListener(handler);
  }, []);

  useEffect(() => {
    if (!isEnabled) return;

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const table = target.closest('table') as HTMLTableElement | null;
      if (!table) return;

      clearTimeout(hideTimer.current);

      const rect = table.getBoundingClientRect();
      const parsed = parseTable(table);
      if (parsed.rowCount === 0 && parsed.headers.length === 0) return;

      setFab({
        visible: true,
        x: rect.right - 40,
        y: rect.top + 4,
        table: parsed,
      });
    };

    const handleMouseOut = (e: MouseEvent) => {
      const related = e.relatedTarget as HTMLElement | null;
      if (related?.closest('table')) return;
      if (fabRef.current?.contains(related as Node)) return;

      hideTimer.current = setTimeout(() => {
        if (!menuOpen) {
          setFab((prev) => ({ ...prev, visible: false }));
          setMenuOpen(false);
        }
      }, 400);
    };

    const handleScroll = () => {
      if (fab.visible && !menuOpen) {
        setFab((prev) => ({ ...prev, visible: false }));
      }
    };

    document.addEventListener('mouseover', handleMouseOver, true);
    document.addEventListener('mouseout', handleMouseOut, true);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('mouseover', handleMouseOver, true);
      document.removeEventListener('mouseout', handleMouseOut, true);
      window.removeEventListener('scroll', handleScroll, true);
      clearTimeout(hideTimer.current);
    };
  }, [menuOpen, isEnabled, fab.visible]);

  const handleExport = useCallback(
    async (format: 'xlsx' | 'csv') => {
      if (!fab.table) return;
      setMenuOpen(false);

      // 向后台请求积分检查并扣除
      const result = await requestCheckAndConsume();

      if (!result.allowed) {
        if (result.reason === 'not_logged_in') {
          showToast(t('loginRequiredToExport', lang));
          openLoginPage();
          return;
        }

        openPaymentPage();
        return;
      }

      try {
        exportToExcel(fab.table, { format, withIndex: false });
        const fmt = format.toUpperCase();
        const hint = result.remaining !== undefined
          ? t('creditsLeft', lang, { n: result.remaining })
          : '';
        showToast(t('exportedAs', lang, { fmt }) + hint);
      } catch {
        showToast(t('exportFailed', lang));
      }
    },
    [fab.table, lang, showToast],
  );

  if (!fab.visible || !isEnabled) return null;

  return (
    <>
      <div
        ref={fabRef}
        style={{
          position: 'fixed',
          left: `${fab.x}px`,
          top: `${fab.y}px`,
          zIndex: 2147483647,
          pointerEvents: 'auto',
        }}
        onMouseEnter={() => clearTimeout(hideTimer.current)}
        onMouseLeave={() => {
          if (!menuOpen) {
            hideTimer.current = setTimeout(() => {
              setFab((prev) => ({ ...prev, visible: false }));
            }, 400);
          }
        }}
      >
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '8px',
            backgroundColor: '#1a73f5',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 12px rgba(26,115,245,0.4)',
            transition: 'transform 0.15s, box-shadow 0.15s',
            pointerEvents: 'auto',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'scale(1.12)';
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(26,115,245,0.5)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 2px 12px rgba(26,115,245,0.4)';
          }}
          title={t('exportTableTitle', lang)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="8" y1="13" x2="16" y2="13" />
            <line x1="8" y1="17" x2="16" y2="17" />
            <line x1="10" y1="9" x2="8" y2="9" />
          </svg>
        </button>

        {menuOpen && (
          <div
            style={{
              position: 'absolute',
              top: '38px',
              right: '0',
              width: '220px',
              backgroundColor: '#fff',
              borderRadius: '12px',
              boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
              border: '1px solid #e5e7eb',
              overflow: 'hidden',
              animation: 'smartexcel-fadein 0.15s ease',
              pointerEvents: 'auto',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            {/* Table info */}
            <div style={{
              padding: '10px 14px', backgroundColor: '#f9fafb',
              borderBottom: '1px solid #e5e7eb', fontSize: '12px', color: '#6b7280',
            }}>
              📋 {fab.table ? t('rowsCols', lang, { r: fab.table.rowCount, c: fab.table.colCount }) : ''}
            </div>

            <MenuItem icon="📊" label={t('exportAsExcel', lang)} sublabel=".xlsx" onClick={() => handleExport('xlsx')} />
            <MenuItem icon="📄" label={t('exportAsCsv', lang)} sublabel=".csv" onClick={() => handleExport('csv')} />
          </div>
        )}
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
          backgroundColor: '#1a73f5', color: '#fff', padding: '10px 24px',
          borderRadius: '10px', fontSize: '14px', boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
          zIndex: 2147483647, animation: 'smartexcel-fadein 0.2s ease',
          pointerEvents: 'auto', fontFamily: 'system-ui, -apple-system, sans-serif',
          whiteSpace: 'nowrap',
        }}>
          ✓ {toast}
        </div>
      )}

      <style>{`
        @keyframes smartexcel-fadein {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}

function MenuItem({ icon, label, sublabel, onClick }: {
  icon: string;
  label: string;
  sublabel?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
        padding: '10px 14px', backgroundColor: 'transparent', border: 'none',
        cursor: 'pointer', fontSize: '13px', color: '#374151',
        transition: 'background-color 0.12s', textAlign: 'left',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        pointerEvents: 'auto',
      }}
      onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#f3f4f6'; }}
      onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
    >
      <span style={{ fontSize: '16px', lineHeight: 1 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {sublabel && <span style={{ fontSize: '11px', color: '#9ca3af' }}>{sublabel}</span>}
    </button>
  );
}
