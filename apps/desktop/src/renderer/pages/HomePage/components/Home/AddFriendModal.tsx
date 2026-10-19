import { CheckCircle2, TriangleAlert } from "lucide-react";

import Modal from "../../../../components/Modal/Modal";
import { useFriendRequest } from "../../../../hooks/useFriend";

import styles from "./Home.module.css";

export default function AddFriendModal({ onClose }: { onClose: () => void }) {
    const { query, setQuery, state, add, reset } = useFriendRequest();

    const busy = state.status === "sending";

    async function handleAdd() {
        try {
            await add();
        } catch {
            /* a mensagem de erro é exibida em `state` */
        }
    }

    function handleClose() {
        reset();
        onClose();
    }

    return (
        <Modal title="Adicionar amigo" onClose={handleClose} width={480}>
            <div className={styles.modalBody}>
                <p className={styles.modalHint}>Digite o nome de usuário de quem você quer adicionar.</p>

                <div className={styles.joinRow}>
                    <input
                        className={styles.joinField}
                        autoFocus
                        value={query}
                        onChange={(e) => setQuery(e.target.value.toLowerCase())}
                        placeholder="Insira um nome de usuário"
                        onKeyDown={(e) => {
                            if (e.key === "Enter") void handleAdd();
                        }}
                    />
                    <button type="button" className={styles.joinBtn} onClick={() => void handleAdd()} disabled={busy}>
                        {busy ? "Enviando..." : "Adicionar"}
                    </button>
                </div>

                {state.status === "sent" && (
                    <p className={styles.modalSuccess}>
                        <CheckCircle2 size={15} aria-hidden="true" />
                        <span>Pedido enviado para <strong>@{state.username}</strong></span>
                    </p>
                )}

                {state.status === "error" && (
                    <p className={styles.modalError}>
                        <TriangleAlert size={15} aria-hidden="true" />
                        <span>{state.message}</span>
                    </p>
                )}
            </div>
        </Modal>
    );
}
