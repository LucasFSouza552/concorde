import axios, { type InternalAxiosRequestConfig } from "axios";

import type { ApiError, LoginResponse } from "@concorde/shared";
import {
    clearSession,
    getStoredRefreshToken,
    getStoredToken,
    saveSession
} from "./session";

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8787";
export const WS_BASE_URL = API_BASE_URL.replace(/^http/, "ws");

export const api = axios.create({
    baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
    const token = getStoredToken();

    if (token) {
        config.headers.set("Authorization", `Bearer ${token}`);
    }

    return config;
});

// Rotas que não devem disparar auto-refresh (o 401 nelas é resposta de negócio).
const AUTH_ROUTES = ["/auth/login", "/auth/register", "/auth/refresh", "/auth/logout"];

const REFRESH_ROUTE = "/auth/refresh";

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
    const refreshToken = getStoredRefreshToken();

    if (!refreshToken) return null;

    try {
        const response = await axios.post<LoginResponse>(`${API_BASE_URL}${REFRESH_ROUTE}`, { refreshToken });

        saveSession(response.data);

        return response.data.token;
    } catch {
        clearSession();
        return null;
    }
}

api.interceptors.response.use(undefined, async (error) => {
    if (!axios.isAxiosError(error)) throw error;

    const config = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;

    if (error.response?.status !== 401 || !config || config._retried) {
        throw error;
    }

    const url = config.url ?? "";

    if (AUTH_ROUTES.some((route) => url.includes(route))) {
        throw error;
    }

    // single-flight: outras 401s paralelas aguardam o MESMO refresh
    refreshInFlight ??= refreshAccessToken();

    const token = await refreshInFlight;
    refreshInFlight = null;

    if (!token) {
        // refresh falhou: sessão foi limpa; a UI reage pelo AuthContext
        throw error;
    }

    config._retried = true;
    config.headers.set("Authorization", `Bearer ${token}`);

    return api(config);
});

export function getErrorMessage(error: unknown): string {
    if (axios.isAxiosError<ApiError>(error)) {
        if (error.response) {
            console.log("error", error);
        }
        return error.response?.data?.message ?? "Não foi possível completar a requisição";
    }
    return "Erro inesperado";
}

export function isUnauthorized(error: unknown): boolean {
    return axios.isAxiosError(error) && error.response?.status === 401;
}
