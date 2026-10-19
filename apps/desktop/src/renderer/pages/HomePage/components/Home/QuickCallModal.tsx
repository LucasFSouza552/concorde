import { useMemo, useState } from "react";
import { Phone, Search } from "lucide-react";

import Modal from "../../../../components/Modal/Modal";
import type { Friend } from "@concorde/shared";
import { useCallInviteState } from "../../../../contexts/CallInviteProvider";

import { STATUS_LABEL } from "../../../../utils/status";
import { useFriendsPresence } from "../../../../hooks/useFriendsPresence";

import styles from "./Home.module.css";

export default function QuickCallModal({ friends, onClose }: { friends: Friend[]; onClose: () => void }) {
    const { dial } = useCallInviteState();
    const [query, setQuery] = useState("");
    const [busy, setBusy] = useState(false);
    const presences = useFriendsPresence(friends);

    const results = useMemo(() => {
        const term = query.trim().toLowerCase();
        const list = term
            ? friends.filter((friend) =>
                friend.displayName.toLowerCase().includes(term) || friend.username.toLowerCase().includes(term))
            : friends;

        return [...list].sort((a, b) => {
            const onlineA = presences.get(a.id)?.status === "online" ? 1 : 0;
            const onlineB = presences.get(b.id)?.status === "online" ? 1 : 0;
            if (onlineA !== onlineB) return onlineB - onlineA;
            return a.displayName.localeCompare(b.displayName);
        });
    }, [friends, presences, query]);

    async function handleCall(friend: Friend) {
        if (busy) return;
        setBusy(true);
        try {
            await dial(friend);
            onClose();
        } catch {
            /* o provedor de chamada já sinaliza falhas de rede */
        } finally {
            setBusy(false);
        }
    }

    return (
        <Modal title="Iniciar chamada rápida" onClose={onClose} width={520}>
            <div className={styles.modalBody}>
                <div className={styles.modalSearch}>
                    <Search size={15} aria-hidden="true" />
                    <input
                        className={styles.modalSearchField}
                        autoFocus
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Buscar amigo"
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && results[0]) void handleCall(results[0]);
                        }}
                    />
                </div>

                {friends.length === 0 && (
                    <p className={styles.modalHint}>Adicione amigos para poder ligar.</p>
                )}

                {friends.length > 0 && results.length === 0 && (
                    <p className={styles.modalHint}>Nenhum amigo encontrado.</p>
                )}

                <div className={styles.modalList}>
                    {results.map((friend) => {
                        const presence = presences.get(friend.id);

                        return (
                            <div key={friend.id} className={styles.modalRow}>
                                <span className={styles.listAvatar} aria-hidden="true">
                                    {friend.displayName.trim().charAt(0).toUpperCase() || "?"}
                                </span>
                                <div className={styles.listText}>
                                    <span className={styles.listName}>{friend.displayName}</span>
                                    <span className={styles.listSub}>
                                        @{friend.username}
                                        {presence?.status && presence.status !== "offline"
                                            ? ` · ${STATUS_LABEL[presence.status]}`
                                            : " · Offline"}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    className={styles.rowIconBtn}
                                    disabled={busy}
                                    title={`Ligar para ${friend.displayName}`}
                                    aria-label={`Ligar para ${friend.displayName}`}
                                    onClick={() => void handleCall(friend)}
                                >
                                    <Phone size={15} aria-hidden="true" />
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </Modal>
    );
}