import { create } from 'zustand';
import type { ParsedTable } from './table-parser';
import { type Lang, detectBrowserLang } from './i18n';

interface ExtensionState {
  tables: ParsedTable[];
  activeTableId: string | null;
  isEnabled: boolean;
  lang: Lang;

  setTables: (tables: ParsedTable[]) => void;
  setActiveTable: (id: string | null) => void;
  toggleEnabled: () => void;
  /** Update language in-memory and persist to storage. */
  setLang: (lang: Lang) => void;
  /** Read saved language preference from storage on mount. */
  initLang: () => Promise<void>;
}

export const useExtensionStore = create<ExtensionState>((set) => ({
  tables: [],
  activeTableId: null,
  isEnabled: true,
  lang: detectBrowserLang(),

  setTables: (tables) => set({ tables }),
  setActiveTable: (id) => set({ activeTableId: id }),
  toggleEnabled: () => set((s) => ({ isEnabled: !s.isEnabled })),
  setLang: (lang) => {
    set({ lang });
    browser.storage.local.set({ se_lang: lang });
  },
  initLang: async () => {
    const result = await browser.storage.local.get('se_lang');
    if (result.se_lang) {
      set({ lang: result.se_lang as Lang });
    }
  },
}));
