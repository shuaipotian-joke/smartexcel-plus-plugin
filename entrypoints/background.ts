const SMARTEXCEL_URL = import.meta.env.DEV
  ? 'http://localhost:3000'
  : 'https://smarterexcel.com';
const PLUGIN_BRIDGE_URL = `${SMARTEXCEL_URL}/plugin-auth/bridge`;
const PLUGIN_ME_URL = `${SMARTEXCEL_URL}/api/plugin/auth/me`;
const PLUGIN_CONSUME_URL = `${SMARTEXCEL_URL}/api/plugin/consume`;
const PLUGIN_CREATE_LOGIN_TICKET_URL = `${SMARTEXCEL_URL}/api/plugin/auth/create-login-ticket`;
const PLUGIN_REVOKE_URL = `${SMARTEXCEL_URL}/api/plugin/auth/revoke`;

function buildBridgeUrl(options?: {
  authMode?: 'login' | 'register';
  planId?: string;
  redirectTo?: string;
}) {
  const bridgeUrl = new URL(PLUGIN_BRIDGE_URL);
  bridgeUrl.searchParams.set('auth', options?.authMode ?? 'login');

  if (options?.planId) {
    bridgeUrl.searchParams.set('planId', options.planId);
  }

  if (options?.redirectTo) {
    bridgeUrl.searchParams.set('redirectTo', options.redirectTo);
  }

  return bridgeUrl.toString();
}

function buildPaymentRedirectPath(planId?: string) {
  const url = new URL('/plugin-payment', SMARTEXCEL_URL);
  url.searchParams.set('closeAfterPayment', 'true');
  if (planId) {
    url.searchParams.set('planId', planId);
  }

  return `${url.pathname}${url.search}`;
}

function buildWebsiteRedirectPath(tableId?: string) {
  if (tableId) {
    return `/import?source=extension&tableId=${encodeURIComponent(tableId)}`;
  }

  return '/dashboard';
}

async function getStoredPluginSession() {
  const result = await browser.storage.local.get([
    'se_plugin_token',
    'se_plugin_token_expires_at',
    'se_logged_in',
    'se_credits',
    'se_email',
    'se_name',
    'se_user_id',
  ]);

  return {
    token: (result.se_plugin_token as string) || '',
    tokenExpiresAt: (result.se_plugin_token_expires_at as string) || '',
    loggedIn: (result.se_logged_in as boolean) || false,
    credits: (result.se_credits as number) || 0,
    email: (result.se_email as string) || '',
    name: (result.se_name as string) || '',
    userId: (result.se_user_id as string) || '',
  };
}

async function clearPluginSession() {
  await browser.storage.local.remove([
    'se_plugin_token',
    'se_plugin_token_expires_at',
    'se_logged_in',
    'se_credits',
    'se_email',
    'se_name',
    'se_user_id',
  ]);
}

async function storePluginSession(data: {
  token: string;
  expiresAt: string;
  credits: number;
  userId: string;
  email?: string;
  name?: string;
}) {
  await browser.storage.local.set({
    se_plugin_token: data.token,
    se_plugin_token_expires_at: data.expiresAt,
    se_logged_in: true,
    se_credits: data.credits,
    se_email: data.email ?? '',
    se_name: data.name ?? '',
    se_user_id: data.userId,
  });
}

async function fetchPluginMe(token: string) {
  const response = await fetch(PLUGIN_ME_URL, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`plugin me failed: ${response.status}`);
  }

  return response.json();
}

async function refreshPluginState() {
  const stored = await getStoredPluginSession();

  if (!stored.token) {
    return {
      loggedIn: false,
      credits: stored.credits,
      email: '',
      name: '',
      userId: '',
      tokenExpiresAt: '',
    };
  }

  try {
    const data = await fetchPluginMe(stored.token);
    if (!data?.loggedIn) {
      await clearPluginSession();
      return {
        loggedIn: false,
        credits: 0,
        email: '',
        name: '',
        userId: '',
        tokenExpiresAt: '',
      };
    }

    await browser.storage.local.set({
      se_logged_in: true,
      se_credits: data.credits ?? 0,
      se_email: data.email ?? '',
      se_name: data.name ?? '',
      se_user_id: data.userId ?? '',
      se_plugin_token_expires_at: data.tokenExpiresAt ?? stored.tokenExpiresAt,
    });

    return {
      loggedIn: true,
      credits: data.credits ?? 0,
      email: data.email ?? '',
      name: data.name ?? '',
      userId: data.userId ?? '',
      tokenExpiresAt: data.tokenExpiresAt ?? stored.tokenExpiresAt,
    };
  } catch (error) {
    console.error('refresh plugin state failed:', error);
    return {
      loggedIn: stored.loggedIn,
      credits: stored.credits,
      email: stored.email,
      name: stored.name,
      userId: stored.userId,
      tokenExpiresAt: stored.tokenExpiresAt,
    };
  }
}

async function createWebsiteLoginTicket(
  token: string,
  redirectTo: string
): Promise<string | null> {
  const response = await fetch(PLUGIN_CREATE_LOGIN_TICKET_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ redirectTo }),
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`create login ticket failed: ${response.status}`);
  }

  const data = await response.json();
  return (data.activateUrl as string) || null;
}

async function openWebsiteWithPluginLogin(
  redirectTo: string,
  fallbackUrl: string
) {
  const stored = await getStoredPluginSession();

  if (stored.token) {
    try {
      const activateUrl = await createWebsiteLoginTicket(stored.token, redirectTo);
      if (activateUrl) {
        await browser.tabs.create({ url: activateUrl });
        return;
      }
    } catch (error) {
      console.error('open website with plugin login failed:', error);
    }
  }

  await browser.tabs.create({ url: fallbackUrl });
}

async function consumeLoggedInCredit(token: string) {
  const response = await fetch(PLUGIN_CONSUME_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    await clearPluginSession();
    return null;
  }

  if (!response.ok) {
    throw new Error(`plugin consume failed: ${response.status}`);
  }

  return response.json();
}

async function revokePluginToken(token: string) {
  try {
    await fetch(PLUGIN_REVOKE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (error) {
    console.error('plugin revoke request failed:', error);
  }
}

// ─── Credit helpers ────────────────────────────────────────────────────────

async function getFreeUsed(): Promise<number> {
  const result = await browser.storage.local.get('se_free_used');
  return (result.se_free_used as number) || 0;
}

/**
 * Check if user can export and consume one credit.
 */
async function checkAndConsume(): Promise<{
  allowed: boolean;
  remaining?: number;
  isLoggedIn: boolean;
  reason?: string;
}> {
  const stored = await getStoredPluginSession();

  if (stored.token) {
    try {
      const result = await consumeLoggedInCredit(stored.token);
      if (result?.success) {
        await browser.storage.local.set({
          se_logged_in: true,
          se_credits: result.remaining ?? 0,
        });
        return {
          allowed: true,
          remaining: result.remaining ?? 0,
          isLoggedIn: true,
        };
      }

      if (result == null) {
        // token invalid, fall through to guest flow
      } else {
        return {
          allowed: false,
          reason: result.error === 'insufficient_credits' ? 'no_credits' : 'internal_error',
          isLoggedIn: true,
        };
      }
    } catch (error) {
      console.error('logged-in consume failed:', error);
      return { allowed: false, reason: 'internal_error', isLoggedIn: true };
    }
  }

  // Not logged in: use 3-free local limit
  const freeUsed = await getFreeUsed();
  const FREE_LIMIT = 3;
  if (freeUsed < FREE_LIMIT) {
    await browser.storage.local.set({ se_free_used: freeUsed + 1 });
    return { allowed: true, remaining: FREE_LIMIT - freeUsed - 1, isLoggedIn: false };
  }
  return { allowed: false, reason: 'free_limit_reached', isLoggedIn: false };
}

async function syncCredits(data: {
  credits: number;
  loggedIn: boolean;
  email?: string;
  name?: string;
}): Promise<void> {
  await browser.storage.local.set({
    se_credits: data.credits,
    se_logged_in: data.loggedIn,
    se_email: data.email ?? '',
    se_name: data.name ?? '',
  });
}

async function syncPluginAuth(data: {
  token: string;
  expiresAt: string;
  credits: number;
  userId: string;
  email?: string;
  name?: string;
}): Promise<void> {
  await storePluginSession(data);
}

// ─── Main background entry ─────────────────────────────────────────────────

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'OPEN_WEBSITE') {
      const redirectTo = buildWebsiteRedirectPath(message.payload?.tableId);
      const fallbackUrl = message.payload?.tableId
        ? `${SMARTEXCEL_URL}${redirectTo}`
        : SMARTEXCEL_URL;

      openWebsiteWithPluginLogin(redirectTo, fallbackUrl)
        .then(() => sendResponse({ ok: true }))
        .catch((error) => {
          console.error('open website failed:', error);
          sendResponse({ ok: false });
        });
      return true;
    }

    if (message.type === 'OPEN_LOGIN') {
      browser.tabs
        .create({
          url: buildBridgeUrl({ authMode: 'login' }),
        })
        .then(() => sendResponse({ ok: true }))
        .catch((error) => {
          console.error('open login bridge failed:', error);
          sendResponse({ ok: false });
        });
      return true;
    }

    if (message.type === 'OPEN_REGISTER') {
      browser.tabs
        .create({
          url: buildBridgeUrl({ authMode: 'register' }),
        })
        .then(() => sendResponse({ ok: true }))
        .catch((error) => {
          console.error('open register bridge failed:', error);
          sendResponse({ ok: false });
        });
      return true;
    }

    if (message.type === 'OPEN_PAYMENT_PAGE') {
      const planId = message.payload?.planId;
      openWebsiteWithPluginLogin(
        buildPaymentRedirectPath(planId),
        buildBridgeUrl({
          authMode: 'register',
          planId,
          redirectTo: buildPaymentRedirectPath(planId),
        })
      )
        .then(() => sendResponse({ ok: true }))
        .catch((error) => {
          console.error('open payment page failed:', error);
          sendResponse({ ok: false });
        });
      return true;
    }

    // Check and consume one export credit (async)
    if (message.type === 'CHECK_AND_CONSUME') {
      checkAndConsume().then(sendResponse);
      return true; // keep channel open for async response
    }

    // Sync credits from plugin-payment page via postMessage relay
    if (message.type === 'PLUGIN_SYNC') {
      syncCredits(message.data).then(() => sendResponse({ ok: true }));
      return true;
    }

    if (message.type === 'PLUGIN_AUTH_SYNC') {
      syncPluginAuth(message.data).then(() => sendResponse({ ok: true }));
      return true;
    }

    if (message.type === 'LOGOUT_PLUGIN') {
      getStoredPluginSession()
        .then(async (stored) => {
          if (stored.token) {
            await revokePluginToken(stored.token);
          }
          await clearPluginSession();
          sendResponse({ ok: true });
        })
        .catch((error) => {
          console.error('logout plugin failed:', error);
          sendResponse({ ok: false });
        });
      return true;
    }

    // Get current credit state (for popup display)
    if (message.type === 'GET_STATE') {
      refreshPluginState().then(async (state) => {
        const freeUsed = await getFreeUsed();
        sendResponse({ ...state, freeUsed, freeLimit: 3 });
      });
      return true;
    }

    return false;
  });

  browser.action.onClicked.addListener(async (tab) => {
    if (tab.id) {
      await browser.tabs.sendMessage(tab.id, { type: 'TOGGLE_PANEL' });
    }
  });
});
