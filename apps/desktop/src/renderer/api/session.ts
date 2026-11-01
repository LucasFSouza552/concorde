import type { LoginTokensResponse } from "@concorde/shared";

const STORAGE_KEY = "concorde:session";

/** Sessão crua do storage, mesmo com access token vencido (o refresh pode ser válido). */
export function getStoredSession(): LoginTokensResponse | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw) as LoginTokensResponse;
        if (!parsed?.user || !parsed?.token || !parsed?.refreshToken || parsed.totpRequired) return null;
        return parsed;
    } catch {
        return null;
    }
}

/** Compatibilidade: considera tudo que existe no storage (o interceptor resolve 401). */
export function getSession(): LoginTokensResponse | null {
    return getStoredSession();
}

export function getStoredToken(): string | null {
    return getStoredSession()?.token ?? null;
}

export function getStoredRefreshToken(): string | null {
    return getStoredSession()?.refreshToken ?? null;
}

export function saveSession(session: LoginTokensResponse) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession() {
    localStorage.removeItem(STORAGE_KEY);
}