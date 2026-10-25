import { useEffect, useRef, useState } from "react";
import { Headphones, HeadphoneOff, Mic, MicOff, Plus, Settings } from "lucide-react";

import type { Friend, GroupRole } from "@concorde/shared";
import { useActiveCall } from "../../contexts/ActiveCallProvider";
import { useAuth } from "../../contexts/AuthContext";
import { useUI } from "../../contexts/UIContext";
import { useUserSocketSend } from "../../contexts/UserSocketProvider";
import IconBtn from "../IconBtn/IconBtn";
import SettingsModal from "../SettingsModal/SettingsModal";

import { setOwnStatus, useOwnStatus } from "../../utils/ownStatus";
import { STATUS_COLOR, STATUS_LABEL } from "../../utils/status";
import { useActiveCalls } from "../../hooks/useActiveCalls";
import { useFriendsList } from "../../hooks/useFriendsList";
import { useFriendsPresence } from "../../hooks/useFriendsPresence";
import { useGroupsList } from "../../hooks/useGroupsList";

import styles from "./UserDock.module.css";

const SETTABLE_STATUSES = ["online", "away", "busy", "invisible"] as const;

export interface ConversationTab {
    key: string;
    kind: "dm" | "group";
    title: string;
    friend?: Friend;
    groupId?: string;
    role?: GroupRole;
}

interface UserDockProps {
    tabs: ConversationTab[];
    activeTabKey: string | null;
    onActivateTab: (tab: ConversationTab) => void;
    onCloseTab: (key: string) => void;
}

export default function UserDock({ tabs, activeTabKey, onActivateTab, onCloseTab }: UserDockProps) {
    const { micMuted, deafened, toggleMic, toggleDeafen } = useActiveCall();
    const { user } = useAuth();
    const { setSidebarOpen } = useUI();
    const send = useUserSocketSend();
    const status = useOwnStatus();
    const lastSentRef = useRef<string | null>(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [statusMenuOpen, setStatusMenuOpen] = useState(false);
    const effectiveMicMuted = micMuted || deafened;

    // Chamadas vivas por conversa, para marcar as abas do rodapé.
    const { friends } = useFriendsList();
    const { groups } = useGroupsList();
    const { calls: activeCalls } = useActiveCalls(groups, friends);
    const presences = useFriendsPresence(friends);

    function tabHasCall(tab: ConversationTab): boolean {
        if (tab.kind === "dm" && tab.friend) return Boolean(presences.get(tab.friend.id)?.inCall);
        if (tab.kind === "group" && tab.groupId) return activeCalls.some((call) => call.group?.id === tab.groupId);
        return false;
    }

    // Envia qualquer mudança de status, sempre dedupeada.
    useEffect(() => {
        if (lastSentRef.current === null) {
            lastSentRef.current = status;
            return;
        }
        if (status === lastSentRef.current) return;

        lastSentRef.current = status;
        send({ type: "set-status", status });
    }, [status, send]);

    // Escape fecha o menu de status; cliques fora são capturados pelo backdrop.
    useEffect(() => {
        if (!statusMenuOpen) return;
        function handleKey(event: KeyboardEvent) {
            if (event.key === "Escape") setStatusMenuOpen(false);
        }
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [statusMenuOpen]);

    function handleKeyOnTab(event: React.KeyboardEvent<HTMLDivElement>) {
        // role="tab" precisa reagir a Enter/Space quando o foco está nele.
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        (event.currentTarget as HTMLDivElement).click();
    }

    return (
        <footer className={styles.footer} aria-label="Perfil e conversas recentes">
            <div className={styles.profile}>
                <div className={styles.avatarWrap}>
                    <div className={styles.avatar}>{(user?.displayName ?? "?").trim().charAt(0).toUpperCase()}</div>
                    <button
                        type="button"
                        className={styles.statusDot}
                        style={{ background: STATUS_COLOR[status] }}
                        title={`Status: ${STATUS_LABEL[status]}`}
                        aria-label={`Alterar status (atual: ${STATUS_LABEL[status]})`}
                        aria-expanded={statusMenuOpen}
                        onClick={() => setStatusMenuOpen((open) => !open)}
                    />
                    {statusMenuOpen && <div className={styles.statusBackdrop} onClick={() => setStatusMenuOpen(false)} />}
                </div>
                {statusMenuOpen && (
                    <div className={styles.statusMenu} role="menu">
                        {SETTABLE_STATUSES.map((option) => (
                            <button
                                key={option}
                                type="button"
                                role="menuitemradio"
                                aria-checked={status === option}
                                className={`${styles.statusItem} ${status === option ? styles.statusItemSelected : ""}`}
                                onClick={() => {
                                    setOwnStatus(option);
                                    setStatusMenuOpen(false);
                                }}
                            >
                                <span className={styles.statusDotStatic} style={{ background: STATUS_COLOR[option] }} />
                                {STATUS_LABEL[option]}
                            </button>
                        ))}
                    </div>
                )}
                <div className={styles.identity}>
                    <span className={styles.username} title={user?.displayName}>
                        {user?.displayName}
                    </span>
                    <span className={styles.userHandle}>@{user?.username}</span>
                </div>
            </div>

            <span className={styles.divider} aria-hidden="true" />

            <div className={styles.controls}>
                <IconBtn
                    id="mute"
                    name={effectiveMicMuted ? "Desmutar" : "Silenciar"}
                    icon={effectiveMicMuted ? MicOff : Mic}
                    handleClick={toggleMic}
                    active={effectiveMicMuted}
                    tone="danger"
                />
                <IconBtn
                    id="muteAudio"
                    name={deafened ? "Ativar áudio" : "Desativar áudio"}
                    icon={deafened ? HeadphoneOff : Headphones}
                    handleClick={toggleDeafen}
                    active={deafened}
                    tone="danger"
                />
                <IconBtn id="config" name="Configurações" icon={Settings} handleClick={() => setSettingsOpen(true)} />
            </div>

            <span className={styles.divider} aria-hidden="true" />

            <nav className={styles.tabs} role="tablist" aria-label="Conversas recentes">
                {tabs.length === 0 ? (
                    <span className={styles.tabsEmpty}>Conversas recentes aparecem aqui</span>
                ) : (
                    tabs.map((tab) => {
                        const active = tab.key === activeTabKey;
                        return (
                            <div
                                key={tab.key}
                                role="tab"
                                tabIndex={0}
                                aria-selected={active}
                                title={tab.title}
                                className={`${styles.tab} ${active ? styles.tabActive : ""}`}
                                onClick={() => onActivateTab(tab)}
                                onKeyDown={handleKeyOnTab}
                            >
                                <span className={styles.tabAvatar} aria-hidden="true">
                                    {tab.title.trim().charAt(0).toUpperCase()}
                                    {tabHasCall(tab) && <span className={styles.tabCallDot} />}
                                </span>
                                <span className={styles.tabTitle}>{tab.title}</span>
                                <button
                                    type="button"
                                    className={styles.tabClose}
                                    aria-label={`Fechar aba ${tab.title}`}
                                    title="Fechar aba"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onCloseTab(tab.key);
                                    }}
                                >
                                    ✕
                                </button>
                            </div>
                        );
                    })
                )}
            </nav>

            <button
                type="button"
                className={styles.tabAdd}
                title="Adicionar conversa"
                aria-label="Adicionar conversa"
                onClick={() => setSidebarOpen(true)}
            >
                <Plus size={18} />
            </button>

            {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
        </footer>
    );
}