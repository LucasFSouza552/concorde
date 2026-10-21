import { useRef, useState } from "react";

import { useToast } from "../../../../../contexts/ToastProvider";

import { getErrorMessage } from "../../../../../api/api";

import styles from "./ChatView.module.css";

interface ChatInputProps {
    sending: boolean;
    cooling: boolean;
    send: (content: string) => Promise<void>;
}

const MAX_LENGTH = 3000;

export default function ChatInput({ sending, cooling, send }: ChatInputProps) {
    const { push } = useToast();
    const [draft, setDraft] = useState("");
    const fieldRef = useRef<HTMLTextAreaElement | null>(null);

    async function handleSend() {
        const text = draft.trim();
        if (!text || sending || cooling) return;

        if (text.length > MAX_LENGTH) {
            push(`Não é possível enviar mais que ${MAX_LENGTH} caracteres.`, "error");
            return;
        }

        setDraft("");
        if (fieldRef.current) fieldRef.current.style.height = "auto";

        try {
            await send(text);
        } catch (error) {
            setDraft(text);
            push(getErrorMessage(error), "error");
        }
    }

    return (
        <div className={styles.chatInput}>
            {draft.length > 300 && (
                <span
                    className={draft.length > MAX_LENGTH - 300 ? `${styles.charCount} ${styles.charCountNear}` : styles.charCount}
                    aria-live="polite"
                >
                    {draft.length}/{MAX_LENGTH}
                </span>
            )}
            <textarea ref={fieldRef} className={styles.chatField} rows={1}
                value={draft}
                onChange={(e) => {
                    setDraft(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
                }} placeholder="Escreva uma mensagem"
                onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleSend();
                    }
                }}></textarea>
            <button type="button" className={styles.sendBtn} disabled={sending || cooling} onClick={() => void handleSend()}>Enviar</button>
        </div>
    );
}
