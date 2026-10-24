import type { LoginResponse } from "@concorde/shared";

const STORAGE_KEY = "concorde:session";

/** Sessão crua do storage, mesmo com access token vencido (o refresh pode ser válido). */
export function getStoredSession(): LoginResponse | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    try {
        return JSON.parse(raw) as LoginResponse;
    } catch {
        return null;
    }
}

/** Compatibilidade: considera tudo que existe no storage (o interceptor resolve 401). */
export function getSession(): LoginResponse | null {
    return getStoredSession();
}

export function getStoredToken(): string | null {
    return getStoredSession()?.token ?? null;
}

export function getStoredRefreshToken(): string | null {
    return getStoredSession()?.refreshToken ?? null;
}

export function saveSession(session: LoginResponse) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession() {
    localStorage.removeItem(STORAGE_KEY);
}