import { useState } from "react";
import type { DiscordRegistrationSuggestion } from "@concorde/shared";

import { useDiscordOAuth } from "../../hooks/useDiscordOAuth";
import Modal from "../Modal/Modal";

import styles from "./DiscordRegistrationModal.module.css";

export default function DiscordRegistrationModal() {
    const { pendingRegistration, cancelRegistration } = useDiscordOAuth();

    if (!pendingRegistration) return null;

    return (
        <Modal title="Confirmar conta do Discord" onClose={cancelRegistration} width={440}>
            <RegistrationForm
                key={pendingRegistration.ticket}
                suggestion={pendingRegistration.suggestion}
                onCancel={cancelRegistration}
            />
        </Modal>
    );
}

function RegistrationForm({
    suggestion,
    onCancel
}: {
    suggestion: DiscordRegistrationSuggestion;
    onCancel: () => void;
}) {
    const { confirmRegistration, busy, error } = useDiscordOAuth();
    const [username, setUsername] = useState(suggestion.username);
    const [displayName, setDisplayName] = useState(suggestion.displayName);
    const [submitting, setSubmitting] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        if (!username.trim() || !displayName.trim()) {
            setLocalError("Preencha o nome de usuário e o nome de exibição.");
            return;
        }

        setSubmitting(true);
        setLocalError(null);
        await confirmRegistration(username.trim(), displayName.trim());
        setSubmitting(false);
    }

    return (
        <>
            <p className={styles.description}>
                Sua conta Discord será usada para entrar no Concorde. Confira os dados e escolha seu nome de usuário.
            </p>

            <div className={styles.preview}>
                {suggestion.avatar ? (
                    <img className={styles.avatar} src={suggestion.avatar} alt="" />
                ) : (
                    <span className={styles.avatarFallback}>
                        {suggestion.displayName.charAt(0).toUpperCase()}
                    </span>
                )}
                <div className={styles.previewText}>
                    <span className={styles.previewName}>{suggestion.displayName}</span>
                    <span className={styles.previewEmail}>{suggestion.email}</span>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                <div className={styles.field}>
                    <label className={styles.label} htmlFor="discord-username">Nome de usuário</label>
                    <input
                        id="discord-username"
                        className={styles.input}
                        value={username}
                        maxLength={32}
                        autoComplete="username"
                        onChange={(event) => setUsername(event.target.value)}
                    />
                </div>
                <div className={styles.field}>
                    <label className={styles.label} htmlFor="discord-display-name">Nome de exibição</label>
                    <input
                        id="discord-display-name"
                        className={styles.input}
                        value={displayName}
                        maxLength={32}
                        onChange={(event) => setDisplayName(event.target.value)}
                    />
                </div>

                {(localError ?? error) && <p className={styles.error} role="alert">{localError ?? error}</p>}

                <div className={styles.actions}>
                    <button type="button" className={styles.secondaryBtn} onClick={onCancel} disabled={submitting}>
                        Cancelar
                    </button>
                    <button type="submit" className={styles.primaryBtn} disabled={submitting || busy}>
                        Criar conta
                    </button>
                </div>
            </form>
        </>
    );
}
