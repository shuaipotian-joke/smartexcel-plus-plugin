import { defineConfig } from 'wxt';
import packageJson from './package.json';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'SmartExcel - Table to Excel Exporter',
    description: '智能识别网页表格，一键导出为 Excel 文件',
    version: packageJson.version,
    permissions: ['activeTab', 'storage', 'scripting'],
    host_permissions: [
      'https://smarterexcel.com/*',
    ],
    icons: {
      128: '/icon-128.png',
    },
    action: {
      default_title: 'SmartExcel',
      default_icon: '/icon-128.png',
    },
  },
});
