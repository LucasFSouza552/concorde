import { Check, X, RotateCcw } from "lucide-react";

import InlineError from "../../../../components/InlineError/InlineError";
import type { Friend } from "@concorde/shared";
import UserIdentity from "./UserIdentity";

import styles from "./Friends.module.css";

interface IncomingRequestsListProps {
    requests: Friend[];
    loading: boolean;
    error: string | null;
    onAccept: (friendId: string) => void;
    onDecline: (friendId: string) => void;
    onReload: () => void;
}

export default function IncomingRequestsList({ requests, loading, error, onAccept, onDecline, onReload }: IncomingRequestsListProps) {
    return (
        <section className={styles.panel}>
            <header className={styles.panelHeader}>
                <h4 className={styles.panelTitle}>
                    Solicitações de amigos
                    <span className={styles.count}>{requests.length}</span>

                </h4>
                <button className={styles.iconButton} type="button" onClick={onReload}>
                    <RotateCcw />
                </button>
            </header>
            {loading && <span>Carregando...</span>}
            {!loading && error && <InlineError message={error} />}
            {!loading && !error && requests.length === 0 && (
                <p>Nenhuma solicitação pendente.</p>
            )}

            {!loading && !error && requests.map((friend) => (
                <div key={friend.id} className={styles.row}>
                    <UserIdentity displayName={friend.displayName} username={friend.username} />

                    <div className={styles.actions}>
                        <button
                            type="button"
                            className={`${styles.rowAction} ${styles.accept}`}
                            aria-label={`Aceitar ${friend.username}`}
                            onClick={() => onAccept(friend.id)}
                        >
                            <Check />
                        </button>
                        <button
                            type="button"
                            className={`${styles.rowAction} ${styles.remove}`}
                            aria-label={`Recusar ${friend.username}`}
                            onClick={() => onDecline(friend.id)}
                        >
                            <X />
                        </button>
                    </div>
                </div>
            ))}

        </section>
    );
}