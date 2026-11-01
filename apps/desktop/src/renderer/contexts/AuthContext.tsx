import {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from "react";

import type { LoginTokensResponse, LoginTotpRequiredResponse, RegisterData, Credentials, User } from "@concorde/shared";

import { api, getErrorMessage, isUnauthorized } from '../api/api';
import { clearSession, getStoredSession, saveSession } from "../api/session";
import { reportAppVersion } from "../utils/versionPolicy";

export type ServerStatus = "booting" | "online" | "offline";

const BOOT_MIN_MS = 700;
const RETRY_INTERVAL_MS = 5000;

interface AuthContextData {
    user: User | null;
    token: string | null;

    login: (userForm: Credentials) => Promise<void>;
    register: (userForm: RegisterData) => Promise<void>;
    updateUser: (next: User) => void;

    logout: () => void;

    /** Credenciais aguardando o código TOTP (2FA) para concluir o login. */
    awaitingTotp: Credentials | null;
    clearAwaitingTotp: () => void;

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
    const [session, setSession] = useState(getStoredSession);
    const user = session?.user ?? null;
    const token = session?.token ?? null;
    const [error, setError] = useState<string | null>(null);
    const [awaitingTotp, setAwaitingTotp] = useState<Credentials | null>(null);
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
        const stored = getStoredSession();
        if (!stored) return false;

        try {
            const { data } = await api.get<User>("/auth/me");
            setSession({ user: data, token: stored.token, refreshToken: stored.refreshToken });
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
            const stored = getStoredSession();

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
        const stored = getStoredSession();
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

    // Telemetria de versão: uma vez por sessão aberta (login ou sessão restaurada).
    useEffect(() => {
        if (!token) return;

        void window.concorde?.app?.getVersion?.().then((version) => {
            if (version) void reportAppVersion(version);
        }).catch(() => { });
    }, [token]);

    async function login(userForm: Credentials) {
        clearError()
        try {
            const response = await api.post<LoginTokensResponse | LoginTotpRequiredResponse>("/auth/login", userForm);

            if (response.data.totpRequired) {
                setSession(null);
                setAwaitingTotp(userForm);
                setError("Informe o código de verificação.");
                return;
            }

            setAwaitingTotp(null);
            saveSession(response.data);
            setSession(response.data);
        } catch (error) {
            const message = getErrorMessage(error);
            setError(message ?? "Não foi possivel entrar")
        }
    }

    async function register(userForm: RegisterData) {
        clearError()
        try {
            const response = await api.post<LoginTokensResponse>("/auth/register", userForm);

            setAwaitingTotp(null);
            saveSession(response.data);
            setSession(response.data);
        } catch (error) {
            const message = getErrorMessage(error);
            setError(message ?? "Não foi possivel registrar")
        }

    }

    function logout() {
        // melhor-esforço: revoga a sessão no servidor usando o refresh token
        const refreshToken = session?.refreshToken;

        if (refreshToken) {
            void api.post("/auth/logout", { refreshToken }).catch(() => { });
        }

        clearSession();
        setSession(null);
        setAwaitingTotp(null);
    }

    function updateUser(next: User) {
        setSession((current) => (current ? { ...current, user: next } : current));
    }

    function clearError() {
        setError(null);
    }

    function clearAwaitingTotp() {
        setAwaitingTotp(null);
    }

    return (
        <AuthContext.Provider
            value={{
                user,
                token,

                login,
                register,
                updateUser,

                logout,

                awaitingTotp,
                clearAwaitingTotp,

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