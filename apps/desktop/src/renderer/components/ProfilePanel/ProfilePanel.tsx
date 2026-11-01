import { useEffect, useState, type ReactNode } from "react";
import { ChevronLeft } from "lucide-react";

import type { UserPresence, UserStatus } from "@concorde/shared";

import { api } from "../../api/api";
import { getCachedPresence } from "../../hooks/useFriendsPresence";
import { STATUS_COLOR, STATUS_LABEL } from "../../utils/status";
import UserAvatar from "../UserAvatar/UserAvatar";

import styles from "./ProfilePanel.module.css";

export interface ProfileUser {
    id: string;
    displayName: string;
    username: string;
    avatar?: string | null;
    bannerFrom?: string | null;
    bannerTo?: string | null;
}

interface ProfilePanelProps {
    user: ProfileUser;
    onClose: () => void;
    /** Rótulo do papel do usuário no contexto (ex.: papel no grupo). */
    roleLabel?: string;
    /** Ações (ex.: "Adicionar amigo"). */
    actions?: ReactNode;
}

export default function ProfilePanel({ user, onClose, roleLabel, actions }: ProfilePanelProps) {
    // Amigo com presença em cache: zero requests já na primeira renderização;
    // só consulta /presence para membros que não estão no cache.
    const cachedOnInit = getCachedPresence(user.id);

    const [presence, setPresence] = useState<UserPresence | null>(cachedOnInit);
    const [presenceFailed, setPresenceFailed] = useState(false);

    // Presença é revalidada a cada abertura (componente remontado por key).
    useEffect(() => {
        if (cachedOnInit) {
            // Painel devolve presença do cache enquanto segue viva aos deltas WS.
            return;
        }

        let cancelled = false;

        void api.get<UserPresence>(`/user/${user.id}/presence`)
            .then(({ data }) => {
                if (!cancelled) setPresence(data);
            })
            .catch(() => {
                if (!cancelled) setPresenceFailed(true);
            });

        return () => {
            cancelled = true;
        };
    }, [user.id, cachedOnInit]);

    // Escape fecha o painel.
    useEffect(() => {
        function handleKey(event: KeyboardEvent) {
            if (event.key === "Escape") onClose();
        }
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [onClose]);

    const status: UserStatus | null = presence
        ? presence.status
        : presenceFailed ? "offline" : null;

    return (
        <section className={styles.panel} aria-label={`Perfil de ${user.displayName}`}>
            <header className={styles.header}>
                <button
                    type="button"
                    className={styles.backBtn}
                    aria-label="Fechar perfil"
                    title="Fechar"
                    onClick={onClose}
                >
                    <ChevronLeft size={16} />
                </button>
                <span className={styles.title}>Perfil</span>
            </header>

            <div className={styles.body}>
                <div
                    className={styles.profileBanner}
                    style={(user.bannerFrom || user.bannerTo)
                        ? { background: `linear-gradient(120deg, ${user.bannerFrom ?? user.bannerTo}, ${user.bannerTo ?? user.bannerFrom})` }
                        : undefined}
                    aria-hidden="true"
                />
                <UserAvatar
                    name={user.displayName}
                    avatar={user.avatar}
                    accent={user.bannerFrom ?? null}
                    size={96}
                    className={styles.avatarOverlap}
                />
                <div className={styles.identity}>
                    <span className={styles.name}>
                        {user.displayName}
                        {status && (
                            <span
                                className={styles.statusDot}
                                style={{ background: STATUS_COLOR[status] }}
                                title={STATUS_LABEL[status]}
                            />
                        )}
                    </span>
                    <span className={styles.handle}>@{user.username}</span>
                    <span className={styles.statusLabel}>
                        {status ? STATUS_LABEL[status] : "Consultando..."}
                    </span>
                    {presence?.customMessage && (
                        <span className={styles.customMessage}>{presence.customMessage}</span>
                    )}
                    {roleLabel && <span className={styles.role}>{roleLabel}</span>}
                </div>
            </div>

            {actions && <div className={styles.actions}>{actions}</div>}
        </section>
    );
}
