import { useEffect, useState } from "react";
import { ArrowRight, BadgeCheck, Clock3, KeyRound, Link2, MessageCircle, RefreshCw, Sparkles, Unlink, UserRound } from "lucide-react";
import type { DiscordEvent, DiscordIntegrationStatus } from "@concorde/shared";

import { getErrorMessage } from "../../api/api";
import {
    applyDiscordProfile,
    getDiscordEvents,
    getDiscordIntegration,
    setDiscordAutoSync,
    setDiscordShowcase,
    setupDiscordPassword,
    unlinkDiscord
} from "../../api/discord";
import { useAuth } from "../../contexts/AuthContext";
import { useDiscordOAuth } from "../../hooks/useDiscordOAuth";
import { useToast } from "../../contexts/ToastProvider";

import styles from "./SettingsModal.module.css";

const EVENT_LABELS: Record<DiscordEvent["kind"], string> = {
    linked: "Discord vinculado",
    login: "Entrou via Discord",
    sync: "Perfil sincronizado",
    unlinked: "Discord desvinculado"
};

export default function IntegrationsSettings() {
    const { user, updateUser, logout } = useAuth();
    const { push } = useToast();
    const {
        startLink,
        startSync,
        cancelFlow,
        busy: oauthBusy,
        error: oauthError,
        revision
    } = useDiscordOAuth();
    const [status, setStatus] = useState<DiscordIntegrationStatus | null>(null);
    const [events, setEvents] = useState<DiscordEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [confirmUnlink, setConfirmUnlink] = useState(false);
    const [password, setPassword] = useState("");
    const [passwordBusy, setPasswordBusy] = useState(false);
    const [showcaseBusy, setShowcaseBusy] = useState(false);
    const [profileBusy, setProfileBusy] = useState(false);
    const [autoSyncBusy, setAutoSyncBusy] = useState(false);

    useEffect(() => {
        let cancelled = false;

        Promise.all([getDiscordIntegration(), getDiscordEvents()])
            .then(([integration, history]) => {
                if (cancelled) return;
                setStatus(integration);
                setEvents(history.events);
                setError(null);
            })
            .catch((cause: unknown) => {
                if (cancelled) return;
                setError(getErrorMessage(cause) ?? "Não foi possível carregar a integração.");
                setStatus(null);
                setEvents([]);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [revision]);

    async function handleUnlink() {
        if (!confirmUnlink) {
            setConfirmUnlink(true);
            return;
        }

        try {
            await unlinkDiscord();
            setConfirmUnlink(false);
            push("Discord desvinculado. Entre novamente para continuar.", "success");
            logout();
        } catch (cause) {
            setError(getErrorMessage(cause) ?? "Não foi possível desvincular o Discord.");
        }
    }

    async function handleShowcase(enabled: boolean) {
        setShowcaseBusy(true);
        setError(null);

        try {
            const next = await setDiscordShowcase(enabled);
            setStatus(next);
            push(enabled ? "Vínculo exibido no perfil." : "Vínculo oculto do perfil.", "success");
        } catch (cause) {
            setError(getErrorMessage(cause) ?? "Não foi possível atualizar a preferência.");
        } finally {
            setShowcaseBusy(false);
        }
    }

    async function refreshEvents() {
        const history = await getDiscordEvents();
        setEvents(history.events);
    }

    async function handleApply() {
        setProfileBusy(true);
        setError(null);

        try {
            const result = await applyDiscordProfile();
            updateUser(result.user);
            setStatus((current) => current ? { ...current, account: result.account } : current);
            await refreshEvents();
            push("Nome e foto do Discord aplicados ao perfil.", "success");
        } catch (cause) {
            setError(getErrorMessage(cause) ?? "Não foi possível aplicar o perfil do Discord.");
        } finally {
            setProfileBusy(false);
        }
    }

    async function handleAutoSync(enabled: boolean) {
        setAutoSyncBusy(true);
        setError(null);

        try {
            const next = await setDiscordAutoSync(enabled);
            setStatus(next);
            push(
                enabled
                    ? "Nome e foto serão aplicados ao entrar com o Discord."
                    : "Aplicação automática desativada.",
                "success"
            );
        } catch (cause) {
            setError(getErrorMessage(cause) ?? "Não foi possível atualizar a aplicação automática.");
        } finally {
            setAutoSyncBusy(false);
        }
    }

    async function handleSetupPassword(event: React.FormEvent) {
        event.preventDefault();
        if (!user || password.length < 8) {
            setError("A senha deve ter pelo menos 8 caracteres.");
            return;
        }

        setPasswordBusy(true);
        setError(null);
        try {
            await setupDiscordPassword(password);
            updateUser({ ...user, hasPassword: true });
            setPassword("");
            push("Senha definida. Você também pode entrar com e-mail e senha.", "success");
        } catch (cause) {
            setError(getErrorMessage(cause) ?? "Não foi possível definir a senha.");
        } finally {
            setPasswordBusy(false);
        }
    }

    return (
        <section className={styles.panel}>
            <h3 className={styles.panelTitle}>Integrações</h3>
            <p className={styles.panelDesc}>Conecte serviços externos à sua conta Concorde.</p>

            <div className={styles.panelStack}>
                <div className={styles.sectionCard}>
                    <div className={styles.sectionHead}>
                        <span className={`${styles.sectionIcon} ${styles.sectionIconAlt}`} aria-hidden="true">
                            <MessageCircle size={16} />
                        </span>
                        <div className={styles.sectionHeadText}>
                            <p className={styles.sectionTitle}>
                                Discord
                                {status?.verified && (
                                    <span className={styles.verifiedTag} title="E-mail verificado no Discord">
                                        <BadgeCheck size={14} /> Verificado
                                    </span>
                                )}
                            </p>
                            <p className={styles.sectionHint}>
                                {loading
                                    ? "Carregando..."
                                    : "Aplique seu nome e foto do Discord ao perfil do Concorde."}
                            </p>
                        </div>
                    </div>

                    {oauthBusy && (
                        <button
                            type="button"
                            className={styles.textCancelBtn}
                            onClick={cancelFlow}
                        >
                            Cancelar autorização
                        </button>
                    )}

                    <div className={styles.integrationBody}>
                        {status?.connected && status.account ? (
                            <>
                                <div className={styles.connectionRow}>
                                    <span className={styles.connectionAvatar} aria-hidden="true">
                                        {status.account.providerAvatar ? (
                                            <img src={status.account.providerAvatar} alt="" />
                                        ) : (
                                            <MessageCircle size={18} />
                                        )}
                                    </span>
                                    <div className={styles.connectionText}>
                                        <strong>
                                            {status.account.providerDisplayName ?? status.account.providerUsername ?? "Discord"}
                                        </strong>
                                        <small>
                                            @{status.account.providerUsername ?? "discord"}
                                            {" · "}
                                            vinculado em {new Date(status.account.linkedAt).toLocaleDateString("pt-BR")}
                                        </small>
                                    </div>
                                    <button
                                        type="button"
                                        className={confirmUnlink ? styles.dangerBtn : styles.subtleBtn}
                                        onClick={() => void handleUnlink()}
                                    >
                                        <Unlink size={14} />
                                        {confirmUnlink ? "Confirmar" : "Desvincular"}
                                    </button>
                                </div>

                                <div className={styles.profilePreview}>
                                    <div className={styles.previewColumn}>
                                        <span className={styles.previewLabel}>Atual no Concorde</span>
                                        <div className={styles.previewIdentity}>
                                            <span className={`${styles.connectionAvatar} ${styles.previewAvatar}`} aria-hidden="true">
                                                {user?.avatar ? <img src={user.avatar} alt="" /> : <UserRound size={16} />}
                                            </span>
                                            <span className={styles.previewText}>
                                                <strong>{user?.displayName ?? "Seu perfil"}</strong>
                                                <small>@{user?.username ?? "você"}</small>
                                            </span>
                                        </div>
                                    </div>

                                    <ArrowRight className={styles.previewArrow} size={16} aria-hidden="true" />

                                    <div className={styles.previewColumn}>
                                        <span className={styles.previewLabel}>Do Discord</span>
                                        <div className={styles.previewIdentity}>
                                            <span className={`${styles.connectionAvatar} ${styles.previewAvatar}`} aria-hidden="true">
                                                {status.account.providerAvatar ? (
                                                    <img src={status.account.providerAvatar} alt="" />
                                                ) : (
                                                    <MessageCircle size={16} />
                                                )}
                                            </span>
                                            <span className={styles.previewText}>
                                                <strong>
                                                    {status.account.providerDisplayName ?? status.account.providerUsername ?? "Discord"}
                                                </strong>
                                                <small>@{status.account.providerUsername ?? "discord"}</small>
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.integrationActions}>
                                    <button
                                        type="button"
                                        className={styles.actionBtn}
                                        onClick={() => void handleApply()}
                                        disabled={profileBusy || oauthBusy}
                                    >
                                        <Sparkles size={15} />
                                        {profileBusy ? "Aplicando..." : "Aplicar nome e foto"}
                                    </button>
                                    <button
                                        type="button"
                                        className={styles.subtleBtn}
                                        onClick={() => void startSync()}
                                        disabled={oauthBusy || profileBusy}
                                    >
                                        <RefreshCw size={14} />
                                        Atualizar e aplicar do Discord
                                    </button>
                                </div>

                                <div className={styles.preferenceStack}>
                                    <label className={styles.toggleRow}>
                                        <span>
                                            <strong>Aplicar automaticamente</strong>
                                            <small>Ao entrar com o Discord, nome e foto são atualizados sozinhos.</small>
                                        </span>
                                        <input
                                            type="checkbox"
                                            checked={Boolean(status.autoSync)}
                                            disabled={autoSyncBusy}
                                            onChange={(event) => void handleAutoSync(event.target.checked)}
                                        />
                                    </label>

                                    <label className={styles.toggleRow}>
                                        <span>
                                            <strong>Exibir no perfil</strong>
                                            <small>Amigos verão seu vínculo e o selo de verificado.</small>
                                        </span>
                                        <input
                                            type="checkbox"
                                            checked={Boolean(status.showcase)}
                                            disabled={showcaseBusy}
                                            onChange={(event) => void handleShowcase(event.target.checked)}
                                        />
                                    </label>
                                </div>

                                <div className={styles.eventList}>
                                    <p className={styles.eventTitle}><Clock3 size={14} /> Histórico</p>
                                    {events.length === 0 ? (
                                        <small>Nenhum evento ainda.</small>
                                    ) : (
                                        events.map((event) => (
                                            <div key={event.id} className={styles.eventRow}>
                                                <span>{EVENT_LABELS[event.kind]}</span>
                                                <time>{new Date(event.createdAt).toLocaleString("pt-BR")}</time>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className={styles.integrationActions}>
                                <button
                                    type="button"
                                    className={styles.actionBtn}
                                    onClick={() => void startLink()}
                                    disabled={oauthBusy || loading}
                                >
                                    <Link2 size={15} />
                                    {oauthBusy ? "Aguardando o Discord..." : "Vincular Discord"}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {user?.hasPassword === false && (
                    <div className={styles.sectionCard}>
                        <div className={styles.sectionHead}>
                            <span className={styles.sectionIcon} aria-hidden="true">
                                <KeyRound size={16} />
                            </span>
                            <div className={styles.sectionHeadText}>
                                <p className={styles.sectionTitle}>Definir senha</p>
                                <p className={styles.sectionHint}>
                                    Sua conta foi criada com o Discord. Defina uma senha para poder entrar sem ele.
                                </p>
                            </div>
                        </div>
                        <form className={styles.formStack} onSubmit={handleSetupPassword}>
                            <label className={styles.fieldLabel} htmlFor="discordSetupPassword">Nova senha</label>
                            <div className={styles.fieldWrap}>
                                <span className={styles.fieldIcon}><KeyRound size={15} /></span>
                                <input
                                    id="discordSetupPassword"
                                    className={styles.fieldInput}
                                    type="password"
                                    value={password}
                                    minLength={8}
                                    autoComplete="new-password"
                                    onChange={(event) => setPassword(event.target.value)}
                                />
                            </div>
                            <button type="submit" className={styles.actionBtn} disabled={passwordBusy}>
                                Salvar senha
                            </button>
                        </form>
                    </div>
                )}

                {oauthError && <p className={styles.errorChip} role="alert">{oauthError}</p>}
                {error && <p className={styles.errorChip} role="alert">{error}</p>}
            </div>
        </section>
    );
}
