import {
    createContext,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from "react";

import type { LoginResponse, RegisterData, Credentials, User } from "@concorde/shared";

import { api, getErrorMessage, isUnauthorized } from '../api/api';
import { clearSession, getSession, saveSession } from "../api/session";

interface AuthContextData {
    user: User | null;
    token: string | null;

    login: (userForm: Credentials) => Promise<void>;
    register: (userForm: RegisterData) => Promise<void>;

    logout: () => void;

    error: string | null;
    clearError: () => void;
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

    useEffect(() => {
        const stored = getSession();

        if (!stored) return;

        let cancelled = false;

        api.get<User>("/auth/me")
            .then(({ data }) => {
                if (cancelled) return;

                setSession({ user: data, token: stored.token });
            })
            .catch((error: unknown) => {
                if (cancelled) return;

                if (isUnauthorized(error)) {
                    setSession(null);
                }
            });

        return () => {
            cancelled = true;
        };
    }, []);

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
                clearError
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