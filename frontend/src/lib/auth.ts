/**
 * Merchant Authentication and Session Management for Waga Stock
 */

export interface MerchantSession {
  access_token: string;
  shop_id: number;
  shop_name: string;
  location: string;
  owner_phone: string;
  telegram_connected: boolean;
  telegram_bot_username: string;
}

export const SESSION_STORAGE_KEY = "waga_merchant_session";
export const TOKEN_STORAGE_KEY = "waga_token";

/** Retrieve current merchant session from localStorage */
export function getSession(): MerchantSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const session: MerchantSession = JSON.parse(raw);
    if (!session || !session.access_token) return null;
    return session;
  } catch {
    return null;
  }
}

/** Save merchant session and standalone token to localStorage */
export function saveSession(session: MerchantSession): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  localStorage.setItem(TOKEN_STORAGE_KEY, session.access_token);
}

/** Clear all auth keys from localStorage */
export function clearSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_STORAGE_KEY);
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

/** Retrieve current access token */
export function getAccessToken(): string | null {
  const session = getSession();
  if (session?.access_token) return session.access_token;
  if (typeof window !== "undefined") {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  }
  return null;
}

/** Check if user currently has an active session token */
export function isAuthenticated(): boolean {
  return !!getAccessToken();
}

/** Logout merchant: clear session and redirect to /login */
export function logout(): void {
  clearSession();
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}
