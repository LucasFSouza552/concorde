import { useEffect, useRef, useState } from "react";
import { EllipsisVertical, MessageCircle, Phone, RotateCcw } from "lucide-react";

import type { Friend } from "@concorde/shared";
import UserIdentity from "./UserIdentity";

import styles from "./Friends.module.css";

interface AcceptedFriendsListProps {
    friends: Friend[];
    loading: boolean;
    error: string | null;
    onRemove: (friendId: string) => void;
    onReload: () => void;
    onChat: (friend: Friend) => void;
    onCall: (friend: Friend) => void;
}

export default function AcceptedFriendsList({ friends, loading, error, onRemove, onReload, onChat, onCall }: AcceptedFriendsListProps) {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!menuOpen) return;

        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setMenuOpen(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [menuOpen]);

    return (
        <section className={styles.panel}>
            <header className={styles.panelHeader}>
                <h4 className={styles.panelTitle}>Meus amigos</h4>
                <button className={styles.button} type="button" onClick={onReload}>
                    <RotateCcw />
                </button>
            </header>

            {loading && <span>Carregando...</span>}
            {!loading && error && <p>{error}</p>}
            {!loading && !error && friends.length === 0 && (
                <p>Você ainda não tem amigos.</p>
            )}

            {!loading && !error && friends.map((friend) => (
                <div key={friend.id} className={styles.row} onClick={() => onChat(friend)}>
                    <UserIdentity displayName={friend.displayName} username={friend.username} />
                    <button className={styles.iconAction}>
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
                            aria-label="Mais opções"
                            aria-haspopup="menu"
                            aria-expanded={menuOpen}
                            onClick={() => {
                                setMenuOpen((open) => !open);
                            }}
                        >
                            <EllipsisVertical />
                        </button>

                        {menuOpen && (
                            <div role="menu" className={styles.menu}>
                                <button type="button" role="menuitem" className={styles.menuItem} onClick={() => {
                                }}>Ver perfil</button>
                                <button type="button" role="menuitem" className={styles.menuItem} onClick={() => {
                                    onRemove(friend.id)
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