export type Lang = 'zh' | 'en';

export const SUPPORTED_LANGS: Lang[] = ['zh', 'en'];

export const LANG_LABELS: Record<Lang, string> = {
  zh: '中文',
  en: 'English',
};

// Source-of-truth dict (zh). All keys must appear in en too.
const zh = {
  // Popup header
  appSubtitle: '网页表格智能导出',
  settings: '设置',
  back: '返回',

  // Credit bar
  creditsRemaining: '剩余 {n} 次',
  freeCreditsRemaining: '免费剩余 {n} 次',
  addCredits: '添加次数',

  // No tables state
  noTablesFound: '当前页面未检测到表格',
  hoverHint: '鼠标悬停在表格上即可显示导出按钮',

  // Tables list
  tablesDetected: '检测到 {n} 个表格',
  exportAll: '全部导出',

  // Table card
  exportExcel: '导出 Excel',
  csvLabel: 'CSV',

  // Footer
  openWebsite: '打开 SmartExcel 网站 →',

  // Settings panel
  language: '语言',
  usageStats: '使用统计',
  freeUsed: '免费已用',
  freeQuota: '免费次数',
  creditsBalance: '积分余额',
  times: '次',
  notLoggedIn: '未登录',
  loginForMore: '登录获取更多次数',

  // TableOverlay — button / menu labels
  exportTableTitle: 'SmartExcel - 导出表格',
  rowsCols: '{r} 行 × {c} 列',
  hasRowNumbers: '🔢 检测到序号列',
  addRowNumbers: '🔢 添加序号列',
  exportAsExcel: '导出为 Excel',
  exportAsCsv: '导出为 CSV',
  copyToClipboard: '复制到剪贴板',
  sendToSmartExcel: '发送到 SmartExcel',
  aiProcess: 'AI 处理',

  // TableOverlay — toast messages
  exportedAs: '已导出为 {fmt}',
  creditsLeft: '，剩余 {n} 积分',
  freeLeft: '，剩余 {n} 次免费',
  freeUsedUp: '，免费次数已用完',
  exportFailed: '导出失败，请重试',
  copiedToClipboard: '已复制到剪贴板',
  copyFailed: '复制失败，请重试',
} as const;

type TranslationKey = keyof typeof zh;

// en must satisfy the same keys
const en: Record<TranslationKey, string> = {
  appSubtitle: 'Smart Table Exporter',
  settings: 'Settings',
  back: 'Back',

  creditsRemaining: '{n} credits left',
  freeCreditsRemaining: '{n} free exports left',
  addCredits: 'Add Credits',

  noTablesFound: 'No tables found on this page',
  hoverHint: 'Hover over a table to show the export button',

  tablesDetected: '{n} table(s) detected',
  exportAll: 'Export All',

  exportExcel: 'Export Excel',
  csvLabel: 'CSV',

  openWebsite: 'Open SmartExcel website →',

  language: 'Language',
  usageStats: 'Usage Stats',
  freeUsed: 'Free Used',
  freeQuota: 'Free Quota',
  creditsBalance: 'Credits',
  times: 'times',
  notLoggedIn: 'Not logged in',
  loginForMore: 'Login for more exports',

  exportTableTitle: 'SmartExcel - Export Table',
  rowsCols: '{r} rows × {c} cols',
  hasRowNumbers: '🔢 Row numbers detected',
  addRowNumbers: '🔢 Add row numbers',
  exportAsExcel: 'Export as Excel',
  exportAsCsv: 'Export as CSV',
  copyToClipboard: 'Copy to Clipboard',
  sendToSmartExcel: 'Send to SmartExcel',
  aiProcess: 'AI Processing',

  exportedAs: 'Exported as {fmt}',
  creditsLeft: ', {n} credits left',
  freeLeft: ', {n} free exports left',
  freeUsedUp: ', free quota used up',
  exportFailed: 'Export failed, please retry',
  copiedToClipboard: 'Copied to clipboard',
  copyFailed: 'Copy failed, please retry',
};

const dict: Record<Lang, Record<TranslationKey, string>> = { zh, en };

/**
 * Translate a key to the target language with optional variable interpolation.
 * Variables in the template use {varName} syntax.
 */
export function t(
  key: TranslationKey,
  lang: Lang,
  vars?: Record<string, string | number>,
): string {
  const str = dict[lang][key] ?? dict['en'][key] ?? key;
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

/**
 * Detect the preferred language from the browser UI locale.
 * Falls back to 'en' for anything that isn't Chinese.
 */
export function detectBrowserLang(): Lang {
  try {
    const raw =
      (typeof browser !== 'undefined'
        ? browser.i18n.getUILanguage()
        : navigator.language) || 'en';
    return raw.toLowerCase().startsWith('zh') ? 'zh' : 'en';
  } catch {
    try {
      return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
    } catch {
      return 'en';
    }
  }
}
