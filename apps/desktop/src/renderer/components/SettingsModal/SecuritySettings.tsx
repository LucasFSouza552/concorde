import { useCallback, useEffect, useState } from "react";
import { Check, Clock, Copy, KeyRound, LogOut, ShieldCheck, ShieldOff, X } from "lucide-react";

import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastProvider";
import { api, getErrorMessage } from "../../api/api";

import styles from "./SettingsModal.module.css";

interface TotpStatus {
    enabled: boolean;
    pending: boolean;
}

interface UserSessionInfo {
    id: string;
    createdAt: number;
    expiresAt: number;
    lastUsedAt: number;
    userAgent: string | null;
}

/**
 * 2FA desativada por enquanto só no app: os endpoints continuam no backend,
 * mas a UI não expõe ativação (evita usuários entrando no fluxo novo).
 */
const TOTP_UI_ENABLED = false;

function formatDateTime(timestamp: number) {
    return new Date(timestamp).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/** Encurta o user-agent para uma leitura amigável do dispositivo. */
function describeDevice(userAgent: string | null): string {
    if (!userAgent) return "Navegador desconhecido";

    const match = /Windows|Macintosh|Linux|Android|iPhone|iPad/.exec(userAgent);

    return match ? match[0] : userAgent.slice(0, 48);
}

export default function SecuritySettings() {
    const { user, logout } = useAuth();
    const { push } = useToast();

    const [status, setStatus] = useState<TotpStatus | null>(null);
    const [secret, setSecret] = useState<string | null>(null);
    const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null);
    const [code, setCode] = useState("");
    const [totpBusy, setTotpBusy] = useState(false);
    const [totpError, setTotpError] = useState<string | null>(null);

    const [sessions, setSessions] = useState<UserSessionInfo[]>([]);
    const [sessionsBusy, setSessionsBusy] = useState(false);

    const refreshStatus = useCallback(async function refreshStatus() {
        try {
            const { data } = await api.get<TotpStatus>("/auth/me/totp");
            setStatus(data);
        } catch {
            setStatus(null);
        }
    }, []);

    const refreshSessions = useCallback(async function refreshSessions() {
        try {
            const { data } = await api.get<{ sessions: UserSessionInfo[] }>("/auth/me/sessions");
            setSessions(data.sessions ?? []);
        } catch {
            setSessions([]);
        } finally {
            setSessionsBusy(false);
        }
    }, []);

    useEffect(() => {
        // Carga inicial fora do corpo direto do efeito (setState assíncrono).
        let cancelled = false;

        api.get<TotpStatus>("/auth/me/totp")
            .then((response) => {
                if (!cancelled) setStatus(response.data);
            })
            .catch(() => {
                if (!cancelled) setStatus(null);
            });

        api.get<{ sessions: UserSessionInfo[] }>("/auth/me/sessions")
            .then((response) => {
                if (!cancelled) setSessions(response.data.sessions ?? []);
            })
            .catch(() => {
                if (!cancelled) setSessions([]);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    async function startEnrollment() {
        setTotpBusy(true);
        setTotpError(null);

        try {
            const { data } = await api.post<{ secret: string; otpauthUrl: string }>("/auth/me/totp/enroll");
            setSecret(data.secret);
            setOtpauthUrl(data.otpauthUrl);
            setCode("");
        } catch (error) {
            setTotpError(getErrorMessage(error) ?? "Não foi possível iniciar a ativação.");
        } finally {
            setTotpBusy(false);
        }
    }

    async function confirmEnrollment() {
        setTotpBusy(true);
        setTotpError(null);

        try {
            await api.post("/auth/me/totp/confirm", { code });
            push("2FA ativada. Use o código no próximo login.", "success");
            setSecret(null);
            setOtpauthUrl(null);
            setCode("");
            await refreshStatus();
        } catch (error) {
            setTotpError(getErrorMessage(error) ?? "Não foi possível confirmar o código.");
        } finally {
            setTotpBusy(false);
        }
    }

    async function disableTotp() {
        setTotpBusy(true);
        setTotpError(null);

        try {
            await api.post("/auth/me/totp/disable", { code });
            push("2FA desativada.", "success");
            setCode("");
            await refreshStatus();
        } catch (error) {
            setTotpError(getErrorMessage(error) ?? "Não foi possível desativar a 2FA.");
        } finally {
            setTotpBusy(false);
        }
    }

    async function revokeSession(sessionId: string) {
        try {
            await api.delete(`/auth/me/sessions/${sessionId}`);
            await refreshSessions();
        } catch (error) {
            push(getErrorMessage(error) ?? "Não foi possível encerrar a sessão.", "error");
        }
    }

    async function copySecret() {
        if (!secret) return;

        try {
            await navigator.clipboard.writeText(secret);
            push("Segredo copiado.", "success");
        } catch {
            setTotpError("Não foi possível copiar — selecione o texto manualmente.");
        }
    }

    const totpHealthy = status?.enabled === true;

    return (
        <section className={styles.panel}>
            <h3 className={styles.panelTitle}>Segurança</h3>
            <p className={styles.panelDesc}>Autenticação de dois fatores e sessões da conta.</p>

            <div className={styles.panelStack}>
                {TOTP_UI_ENABLED && (
                    <div className={styles.sectionCard}>
                        <div className={styles.sectionHead}>
                            <span className={`${styles.sectionIcon} ${styles.sectionIconAlt}`} aria-hidden="true">
                                <ShieldCheck size={16} />
                            </span>
                            <div className={styles.sectionHeadText}>
                                <p className={styles.sectionTitle}>2FA (app autenticador)</p>
                                <p className={styles.sectionHint}>
                                    {totpHealthy
                                        ? "Ativa — o login passa a pedir o código do app."
                                        : "Códigos de 6 dígitos que mudam a cada 30 segundos."}
                                </p>
                            </div>
                        </div>

                    {totpHealthy ? (
                        <div className={styles.formStack}>
                            <label className={styles.fieldLabel} htmlFor="disableTotpInput">Código atual (para desativar)</label>
                            <div className={styles.fieldWrap}>
                                <span className={styles.fieldIcon}><KeyRound size={15} /></span>
                                <input
                                    id="disableTotpInput"
                                    className={styles.fieldInput}
                                    inputMode="numeric"
                                    maxLength={6}
                                    value={code}
                                    placeholder="000000"
                                    onChange={(event) => { setCode(event.target.value.replace(/\D/g, "")); setTotpError(null); }}
                                />
                            </div>

                            {totpError && (
                                <p className={styles.errorChip}>
                                    <ShieldCheck size={13} />
                                    {totpError}
                                </p>
                            )}

                            <button
                                type="button"
                                className={styles.dangerBtn}
                                disabled={totpBusy || code.length !== 6}
                                onClick={() => { void disableTotp(); }}
                            >
                                <ShieldOff size={15} />
                                {totpBusy ? "Desativando..." : "Desativar 2FA"}
                            </button>
                        </div>
                    ) : secret ? (
                        <div className={styles.formStack}>
                            <label className={styles.fieldLabel}>1. Salve o segredo no seu app autenticador</label>
                            <div className={styles.secretBox}>
                                <code>{secret}</code>
                                <button type="button" className={styles.fieldEye} aria-label="Copiar segredo" onClick={() => { void copySecret(); }}>
                                    <Copy size={14} />
                                </button>
                            </div>
                            {otpauthUrl && (
                                <p className={styles.sectionHint}>No app, escolha "adicionar conta" e digite esse segredo (ou cole o link otpauth).</p>
                            )}

                            <label className={styles.fieldLabel} htmlFor="confirmTotpInput">2. Digite o primeiro código</label>
                            <div className={styles.fieldWrap}>
                                <span className={styles.fieldIcon}><KeyRound size={15} /></span>
                                <input
                                    id="confirmTotpInput"
                                    className={styles.fieldInput}
                                    inputMode="numeric"
                                    maxLength={6}
                                    value={code}
                                    placeholder="000000"
                                    onChange={(event) => { setCode(event.target.value.replace(/\D/g, "")); setTotpError(null); }}
                                />
                            </div>

                            {totpError && (
                                <p className={styles.errorChip}>
                                    <ShieldCheck size={13} />
                                    {totpError}
                                </p>
                            )}

                            <button
                                type="button"
                                className={styles.actionBtn}
                                disabled={totpBusy || code.length !== 6}
                                onClick={() => { void confirmEnrollment(); }}
                            >
                                <Check size={15} />
                                {totpBusy ? "Confirmando..." : "Ativar 2FA"}
                            </button>
                        </div>
                    ) : (
                        <div className={styles.formStack}>
                            {totpError && (
                                <p className={styles.errorChip}>
                                    <ShieldCheck size={13} />
                                    {totpError}
                                </p>
                            )}

                            <button
                                type="button"
                                className={styles.actionBtn}
                                disabled={totpBusy || status === null}
                                onClick={() => { void startEnrollment(); }}
                            >
                                <ShieldCheck size={15} />
                                {totpBusy ? "Gerando segredo..." : "Ativar 2FA"}
                            </button>
                        </div>
                    )}
                    </div>
                )}

                <div className={styles.sectionCard}>
                    <div className={styles.sectionHead}>
                        <span className={styles.sectionIcon} aria-hidden="true">
                            <Clock size={16} />
                        </span>
                        <div className={styles.sectionHeadText}>
                            <p className={styles.sectionTitle}>Sessões ativas</p>
                            <p className={styles.sectionHint}>Onde a sua conta está logada. A de agora inclui este app.</p>
                        </div>
                    </div>

                    {sessions.length > 0 && (
                        <ul className={styles.sessionsList}>
                            {sessions.map((session) => (
                                <li key={session.id} className={styles.sessionRow}>
                                    <div className={styles.sessionMeta}>
                                        <p className={styles.sessionTitle}>{describeDevice(session.userAgent)}</p>
                                        <p className={styles.sectionHint}>Criada em {formatDateTime(session.createdAt)}</p>
                                    </div>
                                    <button
                                        type="button"
                                        className={styles.sessionRevoke}
                                        aria-label="Encerrar sessão"
                                        disabled={sessionsBusy}
                                        onClick={() => { void revokeSession(session.id); }}
                                    >
                                        <X size={14} />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}

                    <button
                        type="button"
                        className={styles.dangerBtn}
                        disabled={sessionsBusy || user === null}
                        onClick={logout}
                    >
                        <LogOut size={15} />
                        Encerrar sessão aqui
                    </button>

                    <p className={styles.sectionHint}>Trocar a senha encerra todas as sessões de uma vez.</p>
                </div>
            </div>
        </section>
    );
}
