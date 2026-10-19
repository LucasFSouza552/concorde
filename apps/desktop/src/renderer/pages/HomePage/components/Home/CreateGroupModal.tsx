import { useState } from "react";

import Modal from "../../../../components/Modal/Modal";
import { useToast } from "../../../../contexts/ToastProvider";

import { api, getErrorMessage } from "../../../../api/api";

import type { CreateGroupInput } from "@concorde/shared";

import styles from "./Home.module.css";

interface CreateGroupModalProps {
    onClose: () => void;
    onCreated: () => void;
}

export default function CreateGroupModal({ onClose, onCreated }: CreateGroupModalProps) {
    const [name, setName] = useState("");
    const [busy, setBusy] = useState(false);
    const { push } = useToast();

    async function handleCreate() {
        if (!name.trim() || busy) return;

        setBusy(true);
        try {
            await api.post("/groups", { name: name.trim() } satisfies CreateGroupInput);
            setName("");
            onCreated();
            onClose();
        } catch (error) {
            push(getErrorMessage(error), "error");
        } finally {
            setBusy(false);
        }
    }

    return (
        <Modal title="Criar grupo" onClose={onClose} width={480}>
            <div className={styles.modalBody}>
                <p className={styles.modalHint}>Dê um nome ao grupo e convide o pessoal em seguida.</p>

                <div className={styles.joinRow}>
                    <input
                        className={styles.joinField}
                        autoFocus
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Nome do grupo"
                        onKeyDown={(e) => {
                            if (e.key === "Enter") void handleCreate();
                        }}
                    />
                    <button type="button" className={styles.joinBtn} onClick={() => void handleCreate()} disabled={busy}>
                        {busy ? "Criando..." : "Criar"}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
