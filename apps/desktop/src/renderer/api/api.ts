import axios from "axios";

import type { ApiError } from "@concorde/shared";
import { getStoredToken } from "./session";

export const API_BASE_URL = "http://localhost:8787";
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

export function getErrorMessage(error: unknown): string {
    if (axios.isAxiosError<ApiError>(error)) {
        console.log("error", error);
        return error.response?.data?.message ?? "Não foi possível completar a requisição";
    }
    return "Erro inesperado";
}

export function isUnauthorized(error: unknown): boolean {
    return axios.isAxiosError(error) && error.response?.status === 401;
}