import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import type { DiscordSensitiveAction, LoginTokensResponse } from "@concorde/shared";

import { getErrorMessage } from "../api/api";
import {
    exchangeDiscordCode,
    registerWithDiscord,
    startDiscordLink,
    startDiscordLogin,
    startDiscordReauth,
    startDiscordSync
} from "../api/discord";
import {
    DiscordOAuthContext,
    type PendingDiscordConfirmation,
    type PendingDiscordRegistration
} from "./discord-oauth-context";
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastProvider";

const OAUTH_TIMEOUT_MS = 5 * 60 * 1000;
const OAUTH_FOCUS_GRACE_MS = 2_000;
const OAUTH_CALLBACK_GRACE_MS = 800;

export function DiscordOAuthProvider({ children }: { children: ReactNode }) {
    const { establishSession, updateUser } = useAuth();
    const { push } = useToast();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pendingRegistration, setPendingRegistration] = useState<PendingDiscordRegistration | null>(null);
    const [pendingConfirmation, setPendingConfirmation] = useState<PendingDiscordConfirmation | null>(null);
    const [revision, setRevision] = useState(0);
    const expectedState = useRef<string | null>(null);
    const running = useRef(false);
    const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const focusCheck = useRef<ReturnType<typeof setTimeout> | null>(null);
    const flowStartedAt = useRef(0);

    const resetFlow = useCallback(() => {
        if (timeout.current) clearTimeout(timeout.current);
        if (focusCheck.current) clearTimeout(focusCheck.current);
        timeout.current = null;
        focusCheck.current = null;
        expectedState.current = null;
        flowStartedAt.current = 0;
        running.current = false;
        setBusy(false);
    }, []);

    const fail = useCallback((message: string) => {
        resetFlow();
        setError(message);
        push(message, "error");
    }, [push, resetFlow]);

    const handleCallback = useCallback(async (rawUrl: string) => {
        let url: URL;
        try {
            url = new URL(rawUrl);
        } catch {
            fail("Callback do Discord inválido.");
            return;
        }

        if (url.protocol !== "concorde:") {
            fail("Callback do Discord inválido.");
            return;
        }

        const state = url.searchParams.get("state");
        const expected = expectedState.current;

        if (!expected || !state || state !== expected) {
            fail("Estado OAuth inválido. Tente novamente.");
            return;
        }

        expectedState.current = null;

        const denied = url.searchParams.get("error");
        if (denied) {
            if (denied === "access_denied") {
                resetFlow();
                push("Autorização do Discord cancelada.", "info");
            } else {
                fail("Autorização do Discord recusada.");
            }
            return;
        }

        const code = url.searchParams.get("code");
        if (!code) {
            fail("Código de autorização não recebido.");
            return;
        }

        if (timeout.current) clearTimeout(timeout.current);
        if (focusCheck.current) clearTimeout(focusCheck.current);
        focusCheck.current = null;
        setError(null);

        try {
            const result = await exchangeDiscordCode(code, state);

            if ("registrationRequired" in result) {
                running.current = false;
                setBusy(false);
                setPendingRegistration({ ticket: result.ticket, suggestion: result.suggestion });
                return;
            }

            if ("confirmation" in result) {
                setPendingConfirmation(result.confirmation);
                resetFlow();
                push("Identidade confirmada. Conclua a alteração.", "success");
                return;
            }

            if ("status" in result && result.status === "synced") {
                updateUser(result.user);
                resetFlow();
                setRevision((value) => value + 1);
                push("Perfil sincronizado com o Discord.", "success");
                return;
            }

            if ("token" in result) {
                const session: LoginTokensResponse = result;
                establishSession(session);
                resetFlow();
                push("Conectado com o Discord.", "success");
                if (session.warning) push(session.warning, "error");
                return;
            }

            resetFlow();
            setRevision((value) => value + 1);
            push("Discord vinculado à sua conta.", "success");
        } catch (cause) {
            fail(getErrorMessage(cause) ?? "Não foi possível concluir a autorização com o Discord.");
        }
    }, [establishSession, fail, push, resetFlow, updateUser]);

    useEffect(() => {
        return window.concorde?.auth?.onCallback((url) => {
            void handleCallback(url);
        });
    }, [handleCallback]);

    useEffect(() => {
        function checkReturn() {
            if (!running.current || !expectedState.current) return;
            if (Date.now() - flowStartedAt.current < OAUTH_FOCUS_GRACE_MS) return;
            if (focusCheck.current) return;

            focusCheck.current = setTimeout(() => {
                focusCheck.current = null;

                if (running.current && expectedState.current) {
                    fail("Autorização do Discord não concluída. Se a janela foi fechada, tente novamente.");
                }
            }, OAUTH_CALLBACK_GRACE_MS);
        }

        function handleVisibility() {
            if (document.visibilityState === "visible") checkReturn();
        }

        window.addEventListener("focus", checkReturn);
        document.addEventListener("visibilitychange", handleVisibility);

        return () => {
            window.removeEventListener("focus", checkReturn);
            document.removeEventListener("visibilitychange", handleVisibility);
        };
    }, [fail]);

    const begin = useCallback(async (
        kind: "login" | "link" | "sync" | "reauth",
        action?: DiscordSensitiveAction
    ) => {
        if (running.current) return;

        running.current = true;
        setBusy(true);
        setError(null);

        try {
            const start =
                kind === "link" ? await startDiscordLink()
                    : kind === "sync" ? await startDiscordSync()
                        : kind === "reauth" && action ? await startDiscordReauth(action)
                            : await startDiscordLogin();
            expectedState.current = start.state;

            const opened = await window.concorde?.auth?.openExternal(start.url);
            if (opened?.ok === false || !window.concorde) {
                fail("Não foi possível abrir o navegador para autorizar o Discord.");
                return;
            }

            flowStartedAt.current = Date.now();
            timeout.current = setTimeout(() => {
                fail("Tempo da autorização do Discord esgotado.");
            }, OAUTH_TIMEOUT_MS);
        } catch (cause) {
            fail(getErrorMessage(cause) ?? "Não foi possível iniciar a autorização com o Discord.");
        }
    }, [fail]);

    const confirmRegistration = useCallback(async (username: string, displayName: string) => {
        if (!pendingRegistration) return;

        setBusy(true);
        setError(null);

        try {
            const session = await registerWithDiscord(pendingRegistration.ticket, username, displayName);
            establishSession(session);
            setPendingRegistration(null);
            resetFlow();
            push("Conta criada com o Discord.", "success");
        } catch (cause) {
            setBusy(false);
            const message = getErrorMessage(cause) ?? "Não foi possível criar a conta.";
            setError(message);
            push(message, "error");
        }
    }, [establishSession, pendingRegistration, push, resetFlow]);

    const cancelRegistration = useCallback(() => {
        setPendingRegistration(null);
        resetFlow();
    }, [resetFlow]);

    const startSync = useCallback(() => begin("sync"), [begin]);

    const requestSensitiveAction = useCallback((action: DiscordSensitiveAction) => begin("reauth", action), [begin]);

    const clearConfirmation = useCallback(() => setPendingConfirmation(null), []);

    const cancelFlow = useCallback(() => {
        if (!running.current) return;
        resetFlow();
        push("Autorização do Discord cancelada.", "info");
    }, [push, resetFlow]);

    const clearError = useCallback(() => setError(null), []);

    return (
        <DiscordOAuthContext.Provider value={{
            busy,
            error,
            pendingRegistration,
            pendingConfirmation,
            revision,
            startLogin: () => begin("login"),
            startLink: () => begin("link"),
            startSync,
            requestSensitiveAction,
            confirmRegistration,
            cancelRegistration,
            cancelFlow,
            clearConfirmation,
            clearError
        }}>
            {children}
        </DiscordOAuthContext.Provider>
    );
}
