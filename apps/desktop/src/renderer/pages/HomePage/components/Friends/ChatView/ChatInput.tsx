import { useState } from "react";

import { useToast } from "../../../../../contexts/ToastProvider";

import { getErrorMessage } from "../../../../../api/api";

import styles from "./ChatView.module.css";

interface ChatInputProps {
    sending: boolean;
    cooling: boolean;
    send: (content: string) => Promise<void>;
}

export default function ChatInput({ sending, cooling, send }: ChatInputProps) {
    const { push } = useToast();
    const [draft, setDraft] = useState("");

    async function handleSend() {
        const text = draft.trim();
        if (!text || sending || cooling) return;

        setDraft("");
        try {
            await send(text);
        } catch (error) {
            setDraft(text);
            push(getErrorMessage(error), "error");
        }
    }

    return (
        <div className={styles.chatInput}>
            <input className={styles.chatField} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Escreva uma mensagem"
                onKeyDown={(e) => {
                    if (e.key === "Enter") {
                        void handleSend();
                    }
                }} />
            <button type="button" className={styles.sendBtn} disabled={sending || cooling} onClick={() => void handleSend()}>Enviar</button>
        </div>
    );
}
