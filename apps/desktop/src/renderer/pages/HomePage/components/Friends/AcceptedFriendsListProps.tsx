import { useEffect, useRef, useState } from "react";
import { EllipsisVertical, MessageCircle, Phone, RotateCcw } from "lucide-react";

import InlineError from "../../../../components/InlineError/InlineError";
import { SkeletonList } from "../../../../components/Skeleton/Skeleton";
import type { Friend } from "@concorde/shared";
import type { FriendPresence } from "../../../../hooks/useFriendsPresence";
import UserIdentity from "./UserIdentity";

import styles from "./Friends.module.css";

interface AcceptedFriendsListProps {
    friends: Friend[];
    presences?: Map<string, FriendPresence>;
    title?: string;
    loading: boolean;
    error: string | null;
    onRemove: (friendId: string) => void;
    onReload: () => void;
    onChat: (friend: Friend) => void;
    onCall: (friend: Friend) => void;
}

export default function AcceptedFriendsList({ friends, presences, title = "Meus amigos", loading, error, onRemove, onReload, onChat, onCall }: AcceptedFriendsListProps) {
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!menuOpenId) return;

        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setMenuOpenId(null);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [menuOpenId]);

    return (
        <section className={styles.panel}>
            <header className={styles.panelHeader}>
                <h4 className={styles.panelTitle}>
                    {title}
                    <span className={styles.count}>{friends.length}</span>
                </h4>
                <button className={styles.button} type="button" onClick={onReload}>
                    <RotateCcw />
                </button>
            </header>

            {loading && <SkeletonList rows={4} rowHeight={40} />}
            {!loading && error && <InlineError message={error} />}
            {!loading && !error && friends.length === 0 && (
                <p>{title === "Meus amigos" ? "Você ainda não tem amigos." : "Nenhum amigo disponível agora."}</p>
            )}

            {!loading && !error && friends.map((friend) => (
                <div key={friend.id} className={styles.row} onClick={() => onChat(friend)}>
                    <UserIdentity
                        displayName={friend.displayName}
                        username={friend.username}
                        status={presences?.get(friend.id)?.status}
                    />
                    <button
                        type="button"
                        className={styles.iconAction}
                        aria-label={`Abrir conversa com ${friend.displayName}`}
                        onClick={(event) => {
                            event.stopPropagation();
                            onChat(friend);
                        }}
                    >
                        <MessageCircle />
                    </button>
                    <button
                        type="button"
                        className={`${styles.iconAction} ${styles.callBtn}`}
                        aria-label={`Ligar para ${friend.username}`}
                        onClick={(event) => {
                            event.stopPropagation();
                            onCall(friend);
                        }}
                    >
                        <Phone />
                    </button>

                    <div className={styles.rowActions} ref={menuRef} onClick={(event) => {
                        event.stopPropagation();
                    }}>
                        <button
                            type="button"
                            className={styles.iconAction}
                            aria-label={`Mais opções para ${friend.displayName}`}
                            aria-haspopup="menu"
                            aria-expanded={menuOpenId === friend.id}
                            onClick={() => {
                                setMenuOpenId((open) => (open === friend.id ? null : friend.id));
                            }}
                        >
                            <EllipsisVertical />
                        </button>

                        {menuOpenId === friend.id && (
                            <div role="menu" className={styles.menu}>
                                <button type="button" role="menuitem" className={styles.menuItem} onClick={() => {
                                    setMenuOpenId(null);
                                    onRemove(friend.id);
                                }}>Desfazer Amizade</button>
                            </div>
                        )}

                    </div>
                </div >
            ))
            }

        </section >
    )
}
