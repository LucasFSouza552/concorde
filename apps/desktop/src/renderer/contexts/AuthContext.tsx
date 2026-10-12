import {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from "react";

import type { LoginResponse, RegisterData, Credentials, User } from "@concorde/shared";

import { api, getErrorMessage, isUnauthorized } from '../api/api';
import { clearSession, getSession, saveSession } from "../api/session";

export type ServerStatus = "booting" | "online" | "offline";

const BOOT_MIN_MS = 700;
const RETRY_INTERVAL_MS = 5000;

interface AuthContextData {
    user: User | null;
    token: string | null;

    login: (userForm: Credentials) => Promise<void>;
    register: (userForm: RegisterData) => Promise<void>;

    logout: () => void;

    error: string | null;
    clearError: () => void;

    serverStatus: ServerStatus;
    bootStep: string;
    attempts: number;
    retryConnection: () => void;
}

interface AuthProviderProps {
    children: ReactNode;
}

const AuthContext = createContext<AuthContextData | undefined>(undefined);

export function AuthProvider({ children }: AuthProviderProps) {
    const [session, setSession] = useState(getSession);
    const user = session?.user ?? null;
    const token = session?.token ?? null;
    const [error, setError] = useState<string | null>(null);
    const [serverStatus, setServerStatus] = useState<ServerStatus>("booting");
    const [bootStep, setBootStep] = useState("Carregando sessão...");
    const [attempts, setAttempts] = useState(0);
    const retryTimer = useRef<ReturnType<typeof setInterval> | null>(null);

    async function checkServer(): Promise<boolean> {
        try {
            await api.get("/auth/me");
            return true;
        } catch (error) {
            return isUnauthorized(error);
        }
    }

    async function validateSession(): Promise<boolean> {
        const stored = getSession();
        if (!stored) return false;

        try {
            const { data } = await api.get<User>("/auth/me");
            setSession({ user: data, token: stored.token });
            return true;
        } catch (error) {
            if (isUnauthorized(error)) {
                setSession(null);
                return true;
            }
            return false;
        }
    }

    useEffect(() => {
        let cancelled = false;
        const startedAt = Date.now();

        async function boot() {
            const stored = getSession();

            if (!stored) {
                setBootStep("Conectando ao servidor...");
                const up = await checkServer();
                if (cancelled) return;
                await new Promise((resolve) => setTimeout(resolve, Math.max(0, BOOT_MIN_MS - (Date.now() - startedAt))));
                if (cancelled) return;
                setServerStatus(up ? "online" : "offline");
                return;
            }

            setBootStep("Validando sessão...");
            const ok = await validateSession();
            if (cancelled) return;
            await new Promise((resolve) => setTimeout(resolve, Math.max(0, BOOT_MIN_MS - (Date.now() - startedAt))));
            if (cancelled) return;
            setServerStatus(ok ? "online" : "offline");
        }

        void boot();

        return () => {
            cancelled = true;
        };
    }, []);

    async function retryConnection() {
        setAttempts((count) => count + 1);
        setBootStep("Reconectando ao servidor...");
        const stored = getSession();
        const ok = stored ? await validateSession() : await checkServer();
        if (ok) {
            setServerStatus("online");
        }
    }

    useEffect(() => {
        if (serverStatus !== "offline") return;

        retryTimer.current = setInterval(() => {
            void retryConnection();
        }, RETRY_INTERVAL_MS);

        return () => {
            if (retryTimer.current) clearInterval(retryTimer.current);
            retryTimer.current = null;
        };
    }, [serverStatus]);

    useEffect(() => {
        if (session) {
            saveSession(session);
        } else {
            clearSession();
        }
    }, [session]);

    async function login(userForm: Credentials) {
        clearError()
        try {
            const response = await api.post<LoginResponse>("/auth/login", userForm);

            saveSession(response.data);
            setSession({ user: response.data.user, token: response.data.token });
        } catch (error) {
            const message = getErrorMessage(error);
            setError(message ?? "Não foi possivel entrar")
        }
    }

    async function register(userForm: RegisterData) {
        clearError()
        try {
            const response = await api.post<LoginResponse>("/auth/register", userForm);

            saveSession(response.data);
            setSession({ user: response.data.user, token: response.data.token });
        } catch (error) {
            const message = getErrorMessage(error);
            setError(message ?? "Não foi possivel registrar")
        }

    }

    function logout() {
        setSession(null);
    }

    function clearError() {
        setError(null);
    }

    return (
        <AuthContext.Provider
            value={{
                user,
                token,

                login,
                register,

                logout,

                error,
                clearError,

                serverStatus,
                bootStep,
                attempts,
                retryConnection
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error(
            "useAuth must be used inside an AuthProvider",
        );
    }

    return context;
}