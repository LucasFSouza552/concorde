import { useEffect, useRef, useState, type ReactNode } from "react";
import { BadgeCheck, CalendarDays, Check, ChevronRight, Copy, Globe2, MessageCircle, MoreHorizontal, UserMinus, UserPlus, X, XCircle } from "lucide-react";

import UserIdentity from "../../pages/HomePage/components/Friends/UserIdentity";
import type { Friend, UserPresence, UserStatus } from "@concorde/shared";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastProvider";
import DiscordIcon from "../DiscordIcon/DiscordIcon";
import InlineError from "../InlineError/InlineError";
import { SkeletonList } from "../Skeleton/Skeleton";
import UserAvatar from "../UserAvatar/UserAvatar";

import { useOwnStatus } from "../../utils/ownStatus";
import { STATUS_COLOR, STATUS_LABEL } from "../../utils/status";
import { api, getErrorMessage } from "../../api/api";
import { getCachedPresence, usePresenceSnapshot } from "../../hooks/useFriendsPresence";
import { useFriendRelationship, useMutualFriends } from "../../hooks/useProfileSocial";

import styles from "./ProfilePanel.module.css";

export interface ProfileUser {
    id: string;
    displayName: string;
    username: string;
    avatar?: string | null;
    bannerFrom?: string | null;
    bannerTo?: string | null;
    discordVerified?: boolean;
    discordLinked?: boolean;
    discordUsername?: string | null;
    joinedAt?: number | null;
}

export interface ProfilePanelActions {
    onMessage?: (user: ProfileUser) => void;
    onEdit?: () => void;
    onOpenProfile?: (user: ProfileUser) => void;
}

interface ProfilePanelProps {
    user: ProfileUser;
    onClose: () => void;
    roleLabel?: string;
    actions?: ProfilePanelActions;
    extra?: ReactNode;
}

function formatJoinedAt(timestamp?: number | null): string | null {
    if (!timestamp) return null;
    return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" }).format(timestamp);
}

function toProfileUser(friend: Friend): ProfileUser {
    return {
        id: friend.id,
        displayName: friend.displayName,
        username: friend.username,
        avatar: friend.avatar,
        discordVerified: friend.discord?.verified,
        discordLinked: Boolean(friend.discord),
        discordUsername: friend.discord?.username,
    };
}

export default function ProfilePanel({ user, onClose, roleLabel, actions, extra }: ProfilePanelProps) {
    const { user: authUser } = useAuth();
    const { push } = useToast();
    const ownStatus = useOwnStatus();
    const presences = usePresenceSnapshot();

    const isSelf = authUser?.id === user.id;
    const cached = presences.get(user.id) ?? getCachedPresence(user.id);
    const [fetchedPresence, setFetchedPresence] = useState<UserPresence | null>(cached);
    const [moreOpen, setMoreOpen] = useState(false);
    const [actionBusy, setActionBusy] = useState(false);
    const moreRef = useRef<HTMLDivElement | null>(null);

    const relationship = useFriendRelationship(user.id, !isSelf);
    const mutual = useMutualFriends(user.id, !isSelf);

    useEffect(() => {
        if (isSelf || cached) return;

        let cancelled = false;

        void api.get<UserPresence>(`/user/${user.id}/presence`)
            .then(({ data }) => {
                if (!cancelled) setFetchedPresence(data);
            })
            .catch(() => {
                if (!cancelled) setFetchedPresence(null);
            });

        return () => {
            cancelled = true;
        };
    }, [cached, isSelf, user.id]);

    useEffect(() => {
        function handleKey(event: KeyboardEvent) {
            if (event.key === "Escape") onClose();
        }
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [onClose]);

    useEffect(() => {
        if (!moreOpen) return;
        function handlePointer(event: PointerEvent) {
            if (!moreRef.current?.contains(event.target as Node)) setMoreOpen(false);
        }
        window.addEventListener("pointerdown", handlePointer);
        return () => window.removeEventListener("pointerdown", handlePointer);
    }, [moreOpen]);

    const presence = isSelf ? null : (presences.get(user.id) ?? fetchedPresence);
    const status: UserStatus | null = isSelf ? ownStatus : presence?.status ?? (cached ? null : "offline");
    const joinedAt = formatJoinedAt(user.joinedAt ?? (isSelf ? authUser?.createdAt : null));
    const bannerStyle = (user.bannerFrom || user.bannerTo)
        ? { background: `linear-gradient(120deg, ${user.bannerFrom ?? user.bannerTo}, ${user.bannerTo ?? user.bannerFrom})` }
        : undefined;
    const relationshipState = isSelf ? "self" : relationship.state;
    const discordLinked = Boolean(user.discordLinked || user.discordUsername || user.discordVerified);
    const hasDetails = Boolean(roleLabel || discordLinked || joinedAt);

    async function runFriendAction(
        request: () => Promise<unknown>,
        successMessage: string,
        nextState: "friend" | "none" | "pending-out"
    ) {
        if (actionBusy) return;
        setActionBusy(true);
        setMoreOpen(false);

        try {
            await request();
            relationship.setState(nextState);
            push(successMessage, "success");
        } catch (cause) {
            push(getErrorMessage(cause), "error");
        } finally {
            setActionBusy(false);
        }
    }

    function handleAdd() {
        void runFriendAction(
            () => api.post("/friends/requests", { username: user.username }),
            `Pedido enviado para @${user.username}.`,
            "pending-out"
        );
    }

    function handleAccept() {
        void runFriendAction(
            () => api.post(`/friends/requests/${encodeURIComponent(user.id)}/accept`),
            `Vocês agora são amigos.`,
            "friend"
        );
    }

    function handleDecline() {
        void runFriendAction(
            () => api.post(`/friends/requests/${encodeURIComponent(user.id)}/decline`),
            "Pedido recusado.",
            "none"
        );
    }

    function handleCancel() {
        void runFriendAction(
            () => api.post(`/friends/requests/${encodeURIComponent(user.id)}/decline`),
            "Pedido cancelado.",
            "none"
        );
    }

    function handleRemove() {
        void runFriendAction(
            () => api.delete(`/friends/friend/${encodeURIComponent(user.id)}`),
            "Amizade removida.",
            "none"
        );
    }

    async function copyDiscordUsername() {
        if (!user.discordUsername) return;

        try {
            await navigator.clipboard.writeText(user.discordUsername);
            push("Nome de usuário do Discord copiado.", "success");
        } catch {
            push("Não foi possível copiar — selecione o texto manualmente.", "error");
        }
    }

    return (
        <section className={styles.panel} aria-label={isSelf ? "Seu perfil" : `Perfil de ${user.displayName}`}>
            <header className={styles.header}>
                <span className={styles.headerTitle}>
                    <span className={styles.headerDot} aria-hidden="true" />
                    {isSelf ? "Seu perfil" : "Perfil"}
                </span>
                <button
                    type="button"
                    className={styles.closeBtn}
                    aria-label="Fechar perfil"
                    title="Fechar"
                    onClick={onClose}
                >
                    <X size={16} />
                </button>
            </header>

            <div className={styles.scroll}>
                <div className={styles.banner} style={bannerStyle} aria-hidden="true" />

                <div className={styles.avatarRow}>
                    <div className={styles.avatarWrap}>
                        <UserAvatar
                            name={user.displayName}
                            avatar={user.avatar}
                            size={104}
                            className={styles.avatar}
                        />
                        {status && (
                            <span
                                className={styles.avatarStatus}
                                style={{ background: STATUS_COLOR[status] }}
                                title={STATUS_LABEL[status]}
                            />
                        )}
                    </div>
                </div>

                <div className={styles.identity}>
                    <h2 className={styles.name}>
                        <span className={styles.nameText}>{user.displayName}</span>
                        {discordLinked && (
                            <span
                                className={styles.discordBadge}
                                title={user.discordVerified ? "Conta verificada no Discord" : "Conta vinculada ao Discord"}
                            >
                                <DiscordIcon size={14} />
                                {user.discordVerified && <BadgeCheck size={11} />}
                                Discord
                            </span>
                        )}
                    </h2>
                    <span className={styles.handle}>@{user.username}</span>
                    {status && (
                        <span className={styles.statusChip}>
                            <span className={styles.statusDot} style={{ background: STATUS_COLOR[status] }} />
                            {STATUS_LABEL[status]}
                        </span>
                    )}
                    {presence?.customMessage && (
                        <span className={styles.customMessage}>“{presence.customMessage}”</span>
                    )}
                </div>

                {hasDetails && (
                    <div className={styles.details}>
                        {roleLabel && (
                            <div className={styles.detailRow}>
                                <span className={styles.detailIcon}><Globe2 size={14} /></span>
                                <span className={styles.detailLabel}>Contexto</span>
                                <strong className={styles.detailValue}>{roleLabel}</strong>
                            </div>
                        )}
                        {discordLinked && (
                            <div className={styles.detailRow}>
                                <span className={styles.detailIcon}><DiscordIcon size={14} /></span>
                                <span className={styles.detailLabel}>Usuário Discord</span>
                                {user.discordUsername ? (
                                    <span className={styles.detailValueWithCopy}>
                                        <strong
                                            className={styles.detailValue}
                                            title="Nome de usuário usado para adicionar no Discord"
                                        >
                                            @{user.discordUsername}
                                        </strong>
                                        <button
                                            type="button"
                                            className={styles.copyBtn}
                                            title="Copiar nome de usuário do Discord"
                                            aria-label="Copiar nome de usuário do Discord"
                                            onClick={() => void copyDiscordUsername()}
                                        >
                                            <Copy size={13} />
                                        </button>
                                    </span>
                                ) : (
                                    <strong className={styles.detailValue} title="Conta vinculada ao Discord">
                                        Vinculado
                                    </strong>
                                )}
                            </div>
                        )}
                        {joinedAt && (
                            <div className={styles.detailRow}>
                                <span className={styles.detailIcon}><CalendarDays size={14} /></span>
                                <span className={styles.detailLabel}>Desde</span>
                                <strong className={styles.detailValue}>{joinedAt}</strong>
                            </div>
                        )}
                    </div>
                )}

                {!isSelf && (
                    <div className={styles.mutualSection}>
                        <div className={styles.mutualHeader}>
                            <span className={styles.mutualTitle}>Amigos em comum</span>
                            <span className={styles.mutualCount}>{mutual.loading ? "…" : mutual.ids.length}</span>
                        </div>

                        {mutual.loading ? (
                            <SkeletonList rows={3} rowHeight={40} className={styles.mutualSkeletonRow} />
                        ) : mutual.error ? (
                            <InlineError message={mutual.error} onRetry={() => { void mutual.reload(); }} />
                        ) : mutual.friends.length === 0 ? (
                            <span className={styles.mutualEmpty}>Nenhum amigo em comum.</span>
                        ) : (
                            <div className={styles.mutualList}>
                                {mutual.friends.map((friend) => (
                                    <button
                                        key={friend.id}
                                        type="button"
                                        className={styles.mutualRow}
                                        aria-label={`Ver perfil de ${friend.displayName}`}
                                        onClick={() => actions?.onOpenProfile?.(toProfileUser(friend))}
                                    >
                                        <UserIdentity
                                            displayName={friend.displayName}
                                            username={friend.username}
                                            avatar={friend.avatar}
                                            status={presences.get(friend.id)?.status}
                                            discordVerified={Boolean(friend.discord?.verified)}
                                            discordLinked={Boolean(friend.discord)}
                                        />
                                        <ChevronRight size={15} className={styles.mutualChevron} aria-hidden="true" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div className={styles.actions}>
                    {isSelf ? (
                        actions?.onEdit && (
                            <button type="button" className={styles.actionBtn} onClick={actions.onEdit}>
                                Editar perfil
                            </button>
                        )
                    ) : relationship.loading && !relationship.error ? (
                        <span className={styles.actionSkeleton} aria-label="Carregando ações" />
                    ) : relationship.error ? (
                        <InlineError message={relationship.error} onRetry={() => { void relationship.reload(); }} />
                    ) : relationshipState === "friend" ? (
                        <div className={styles.actionRow}>
                            {actions?.onMessage && (
                                <button
                                    type="button"
                                    className={styles.actionBtn}
                                    onClick={() => actions.onMessage?.(user)}
                                >
                                    <MessageCircle size={15} aria-hidden="true" />
                                    Enviar mensagem
                                </button>
                            )}
                            <div className={styles.moreWrap} ref={moreRef}>
                                <button
                                    type="button"
                                    className={styles.moreBtn}
                                    aria-label="Mais ações"
                                    title="Mais ações"
                                    aria-expanded={moreOpen}
                                    onClick={() => setMoreOpen((open) => !open)}
                                >
                                    <MoreHorizontal size={18} />
                                </button>
                                {moreOpen && (
                                    <div className={styles.moreMenu} role="menu">
                                        <button
                                            type="button"
                                            role="menuitem"
                                            className={`${styles.moreMenuItem} ${styles.danger}`}
                                            disabled={actionBusy}
                                            onClick={handleRemove}
                                        >
                                            <UserMinus size={14} aria-hidden="true" />
                                            Desfazer amizade
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : relationshipState === "pending-in" ? (
                        <div className={styles.actionRow}>
                            <button type="button" className={styles.actionBtn} disabled={actionBusy} onClick={handleAccept}>
                                <Check size={15} aria-hidden="true" />
                                Aceitar
                            </button>
                            <button
                                type="button"
                                className={`${styles.actionBtn} ${styles.secondary}`}
                                disabled={actionBusy}
                                onClick={handleDecline}
                            >
                                <XCircle size={15} aria-hidden="true" />
                                Recusar
                            </button>
                        </div>
                    ) : relationshipState === "pending-out" ? (
                        <div className={styles.actionRow}>
                            <button type="button" className={`${styles.actionBtn} ${styles.secondary}`} disabled>
                                Pedido enviado
                            </button>
                            <button
                                type="button"
                                className={`${styles.actionBtn} ${styles.secondary}`}
                                disabled={actionBusy}
                                onClick={handleCancel}
                            >
                                Cancelar
                            </button>
                        </div>
                    ) : (
                        <button type="button" className={styles.actionBtn} disabled={actionBusy} onClick={handleAdd}>
                            <UserPlus size={15} aria-hidden="true" />
                            Adicionar amigo
                        </button>
                    )}

                    {extra}
                </div>
            </div>
        </section>
    );
}