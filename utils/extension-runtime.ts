export function isExtensionContextValid(): boolean {
  try {
    return typeof browser !== 'undefined' && Boolean(browser.runtime?.id);
  } catch {
    return false;
  }
}

export async function safeSendRuntimeMessage<T = unknown>(
  message: unknown
): Promise<T | null> {
  if (!isExtensionContextValid()) {
    return null;
  }

  try {
    return (await browser.runtime.sendMessage(message)) as T;
  } catch {
    return null;
  }
}

export function safeAddStorageChangedListener(
  listener: Parameters<typeof browser.storage.onChanged.addListener>[0]
): () => void {
  if (!isExtensionContextValid()) {
    return () => undefined;
  }

  try {
    browser.storage.onChanged.addListener(listener);
    return () => {
      try {
        browser.storage.onChanged.removeListener(listener);
      } catch {
        // Ignore invalidated extension context during cleanup.
      }
    };
  } catch {
    return () => undefined;
  }
}
