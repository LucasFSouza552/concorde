import type { LoginResponse } from "@concorde/shared";

const STORAGE_KEY = "concorde:session";

function isTokenExpired(token: string) {
    try {
        const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");

        return Date.now() >= JSON.parse(atob(payload)).exp * 1000;
    } catch {
        return true;
    }
}

export function getSession(): LoginResponse | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    try {
        const session = JSON.parse(raw) as LoginResponse;

        return isTokenExpired(session.token) ? null : session;
    } catch {
        return null;
    }
}

export function getStoredToken(): string | null {
    return getSession()?.token ?? null;
}

export function saveSession(session: LoginResponse) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession() {
    localStorage.removeItem(STORAGE_KEY);
}