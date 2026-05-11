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
  creditsRemaining: '永久免费',
  addCredits: '添加次数',
  login: '登录',
  signupBonusHint: '永久免费导出',
  freeEditionEnabled: '免费版已启用，导出不再需要登录或次数。',
  freeEditionDescription: '当前插件所有表格导出功能均可直接使用，无需登录、购买或同步积分。',

  // No tables state
  noTablesFound: '当前页面未检测到表格',
  hoverHint: '鼠标悬停在表格上即可显示导出按钮',

  // Tables list
  tablesDetected: '检测到 {n} 个表格',
  selectedTables: '已选择 {n} 个',
  selectAll: '全选',
  deselectAll: '取消全选',
  exportAll: '全部导出',
  exportSelected: '导出选中',
  confirmExportAll: '当前识别到 {count} 个表格，确定继续导出吗？',
  insufficientCreditsForAll: '无法导出所选表格。',
  clickToBuyCredits: '点击此处购买积分',

  // Table card
  selectTable: '选择表格：{title}',
  exportExcel: '导出 Excel',
  csvLabel: 'CSV',

  // Footer
  openWebsite: '打开 SmartExcel 网站 →',

  // Settings panel
  language: '语言',
  languageRegionHint: '默认根据浏览器地区自动显示语言，也可以在这里手动切换。',
  usageStats: '使用统计',
  pluginMode: '插件模式',
  creditsBalance: '积分余额',
  times: '次',
  notLoggedIn: '未登录',
  createAccount: '注册新账号',
  createAccountForBonus: '注册领取 {n} 次导出',
  loggedInAs: '当前账号：{email}',
  logout: '退出登录',

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
  exportedWithCreditInfo: '已导出为 {fmt}',
  creditsLeft: '',
  exportingPleaseWait: '请稍等，正在导出…',
  loginRequiredToExport: '插件当前为免费版，无需登录即可导出',
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

  creditsRemaining: 'Free forever',
  addCredits: 'Add Credits',
  login: 'Login',
  signupBonusHint: 'Unlimited free exports',
  freeEditionEnabled: 'Free edition enabled. Exporting no longer requires sign-in or credits.',
  freeEditionDescription: 'All table export features are now available directly with no login, purchase, or credit sync.',

  noTablesFound: 'No tables found on this page',
  hoverHint: 'Hover over a table to show the export button',

  tablesDetected: '{n} table(s) detected',
  selectedTables: '{n} selected',
  selectAll: 'Select all',
  deselectAll: 'Deselect all',
  exportAll: 'Export All',
  exportSelected: 'Export selected',
  confirmExportAll: '{count} tables detected. Continue exporting?',
  insufficientCreditsForAll: 'Unable to export the selected tables.',
  clickToBuyCredits: 'Click here to buy credits',

  selectTable: 'Select table: {title}',
  exportExcel: 'Export Excel',
  csvLabel: 'CSV',

  openWebsite: 'Open SmartExcel website →',

  language: 'Language',
  languageRegionHint: 'The panel follows your browser region by default. You can override it here.',
  usageStats: 'Usage Stats',
  pluginMode: 'Plugin Mode',
  creditsBalance: 'Credits',
  times: 'times',
  notLoggedIn: 'Not logged in',
  createAccount: 'Create account',
  createAccountForBonus: 'Create account and get {n} exports',
  loggedInAs: 'Signed in as: {email}',
  logout: 'Log out',

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
  exportedWithCreditInfo: 'Exported as {fmt}',
  creditsLeft: '',
  exportingPleaseWait: 'Please wait, exporting...',
  loginRequiredToExport: 'This plugin is now free and exports without sign-in',
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

const CHINESE_REGION_CODES = new Set(['CN', 'HK', 'MO', 'SG', 'TW']);
const CHINESE_TIME_ZONES = new Set([
  'Asia/Shanghai',
  'Asia/Chongqing',
  'Asia/Harbin',
  'Asia/Hong_Kong',
  'Asia/Macau',
  'Asia/Taipei',
]);

function getLocaleCandidates(): string[] {
  const locales: string[] = [];

  try {
    if (typeof browser !== 'undefined') {
      locales.push(browser.i18n.getUILanguage());
    }
  } catch {
    // ignore
  }

  try {
    const nav = globalThis.navigator;
    if (nav.languages?.length) {
      locales.push(...nav.languages);
    }
    if (nav.language) {
      locales.push(nav.language);
    }
  } catch {
    // ignore
  }

  return locales.filter(Boolean);
}

function localeLooksChinese(locale: string): boolean {
  const normalized = locale.replace('_', '-');
  const parts = normalized.split('-');
  const language = parts[0]?.toLowerCase();
  const region = parts.find((part) => part.length === 2)?.toUpperCase();

  return language === 'zh' || Boolean(region && CHINESE_REGION_CODES.has(region));
}

function timeZoneLooksChinese(): boolean {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return CHINESE_TIME_ZONES.has(timeZone);
  } catch {
    return false;
  }
}

/**
 * Detect the preferred language from browser locale and regional hints.
 * Falls back to English for regions that are not primarily Chinese-speaking.
 */
export function detectBrowserLang(): Lang {
  const locales = getLocaleCandidates();

  if (locales.some(localeLooksChinese)) {
    return 'zh';
  }

  if (timeZoneLooksChinese()) {
    return 'zh';
  }

  return 'en';
}
