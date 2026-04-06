export interface TableInfo {
  id: string;
  title: string;
  rowCount: number;
  colCount: number;
  headers: string[];
  preview: string[][];
}

export type MessageType =
  | { type: 'GET_TABLES'; payload?: never }
  | { type: 'TABLES_RESULT'; payload: TableInfo[] }
  | { type: 'EXPORT_TABLE'; payload: { tableId: string; format: 'xlsx' | 'csv' } }
  | { type: 'EXPORT_CONTEXT_TABLE'; payload: { tableId?: string | null; format: 'xlsx' | 'csv' } }
  | { type: 'COPY_TABLE'; payload: { tableId: string } }
  | { type: 'EXPORT_ALL'; payload?: never }
  | { type: 'SET_CONTEXT_TABLE'; payload: { tableId: string | null } }
  | { type: 'OPEN_WEBSITE'; payload: { tableId?: string } }
  | { type: 'OPEN_LOGIN'; payload?: never }
  | { type: 'OPEN_REGISTER'; payload?: never }
  | { type: 'OPEN_PAYMENT_PAGE'; payload?: { planId?: string } }
  | { type: 'GET_STATE'; payload?: never }
  | { type: 'LOGOUT_PLUGIN'; payload?: never }
  | { type: 'CLEAR_PLUGIN_SESSION'; payload?: never };

export const WEBSITE_URL = 'https://smarterexcel.com';

export function sendMessage(message: MessageType): Promise<any> {
  return browser.runtime.sendMessage(message);
}

export function sendTabMessage(
  tabId: number,
  message: MessageType
): Promise<any> {
  return browser.tabs.sendMessage(tabId, message);
}
