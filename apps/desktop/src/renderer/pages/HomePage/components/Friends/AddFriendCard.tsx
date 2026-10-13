import type { AddState } from "../../../../hooks/useFriend";

import styles from "./Friends.module.css";

interface AddFriendCardProps {
    query: string;
    state: AddState;
    onQueryChange: (value: string) => void;
    onAdd: () => void;
}

export default function AddFriendCard({ query, state, onQueryChange, onAdd }: AddFriendCardProps) {

    const busy = state.status === "sending";

    return (
        <header className={styles.header}>
            <div className={styles.card}>
                <label htmlFor="invite">Adicionar amigo</label>
                <div className={styles.inviteRow}>
                    <input
                        id="invite"
                        value={query}
                        onChange={(e) => onQueryChange(e.target.value.toLowerCase())}
                        placeholder="Insira um nome de usuário"
                        onKeyDown={(e) => {
                            if (e.key === "Enter")
                                onAdd();
                        }} />

                    <button className={styles.inviteBtn} onClick={onAdd} disabled={busy}>
                        Adicionar
                    </button>
                </div>
            </div>
        </header>);
}