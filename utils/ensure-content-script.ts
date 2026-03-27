const CONTENT_SCRIPT_PATH = 'content-scripts/content.js';
const CONTENT_SCRIPT_READY_MESSAGE = { type: 'GET_TABLES' as const };

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function isContentScriptReady(tabId: number) {
  try {
    await browser.tabs.sendMessage(tabId, CONTENT_SCRIPT_READY_MESSAGE);
    return true;
  } catch {
    return false;
  }
}

export async function ensureContentScript(tabId: number) {
  if (await isContentScriptReady(tabId)) {
    return true;
  }

  const tab = await browser.tabs.get(tabId);
  if (!canInjectIntoUrl(tab.url)) {
    return false;
  }

  try {
    await browser.scripting.executeScript({
      target: { tabId },
      files: [CONTENT_SCRIPT_PATH],
    });
  } catch (error) {
    console.error('content script injection failed:', error);
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (await isContentScriptReady(tabId)) {
      return true;
    }
    await delay(100);
  }

  return false;
}
