import { useState } from "react";

import { getErrorMessage } from "../../api/api";
import { changeEmailWithDiscord, changePasswordWithDiscord } from "../../api/discord";
import { useAuth } from "../../contexts/AuthContext";
import { useDiscordOAuth } from "../../hooks/useDiscordOAuth";
import { useToast } from "../../contexts/ToastProvider";
import DiscordIcon from "../DiscordIcon/DiscordIcon";
import Modal from "../Modal/Modal";

import styles from "./DiscordSensitiveModal.module.css";

export default function DiscordSensitiveModal() {
    const { pendingConfirmation, clearConfirmation } = useDiscordOAuth();

    if (!pendingConfirmation) return null;

    return (
        <Modal
            title={pendingConfirmation.action === "email" ? "Alterar e-mail" : "Alterar senha"}
            onClose={clearConfirmation}
            width={440}
        >
            <SensitiveForm
                key={pendingConfirmation.id}
                action={pendingConfirmation.action}
                confirmationId={pendingConfirmation.id}
                onDone={clearConfirmation}
            />
        </Modal>
    );
}

function SensitiveForm({
    action,
    confirmationId,
    onDone
}: {
    action: "email" | "password";
    confirmationId: string;
    onDone: () => void;
}) {
    const { user, logout } = useAuth();
    const { push } = useToast();
    const [email, setEmail] = useState(user?.email ?? "");
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        setError(null);

        if (action === "email" && !email.trim()) {
            setError("Informe o novo e-mail.");
            return;
        }

        if (action === "password" && (newPassword !== confirmPassword || newPassword.length < 6)) {
            setError("As senhas não conferem ou têm menos de 6 caracteres.");
            return;
        }

        setSubmitting(true);

        try {
            if (action === "email") {
                await changeEmailWithDiscord(email.trim(), confirmationId);
            } else {
                await changePasswordWithDiscord(currentPassword, newPassword, confirmationId);
            }

            onDone();
            push("Dados alterados. Entre novamente para continuar.", "success");
            logout();
        } catch (cause) {
            setError(getErrorMessage(cause) ?? "Não foi possível concluir a alteração.");
            setSubmitting(false);
        }
    }

    return (
        <>
            <div className={styles.discordIntro}>
                <DiscordIcon size={22} />
                <p className={styles.description}>
                    Sua identidade foi confirmada pelo Discord. Conclua a alteração abaixo.
                </p>
            </div>

            <form onSubmit={handleSubmit}>
                {action === "email" ? (
                    <div className={styles.field}>
                        <label className={styles.label} htmlFor="discord-new-email">Novo e-mail</label>
                        <input
                            id="discord-new-email"
                            className={styles.input}
                            type="email"
                            value={email}
                            autoComplete="email"
                            onChange={(event) => setEmail(event.target.value)}
                        />
                    </div>
                ) : (
                    <>
                        <div className={styles.field}>
                            <label className={styles.label} htmlFor="discord-current-password">Senha atual</label>
                            <input
                                id="discord-current-password"
                                className={styles.input}
                                type="password"
                                value={currentPassword}
                                autoComplete="current-password"
                                onChange={(event) => setCurrentPassword(event.target.value)}
                            />
                        </div>
                        <div className={styles.field}>
                            <label className={styles.label} htmlFor="discord-new-password">Nova senha</label>
                            <input
                                id="discord-new-password"
                                className={styles.input}
                                type="password"
                                value={newPassword}
                                autoComplete="new-password"
                                onChange={(event) => setNewPassword(event.target.value)}
                            />
                        </div>
                        <div className={styles.field}>
                            <label className={styles.label} htmlFor="discord-confirm-password">Confirmar nova senha</label>
                            <input
                                id="discord-confirm-password"
                                className={styles.input}
                                type="password"
                                value={confirmPassword}
                                autoComplete="new-password"
                                onChange={(event) => setConfirmPassword(event.target.value)}
                            />
                        </div>
                    </>
                )}

                {error && <p className={styles.error} role="alert">{error}</p>}

                <div className={styles.actions}>
                    <button type="button" className={styles.secondaryBtn} onClick={onDone} disabled={submitting}>
                        Cancelar
                    </button>
                    <button type="submit" className={styles.primaryBtn} disabled={submitting}>
                        Confirmar alteração
                    </button>
                </div>
            </form>
        </>
    );
}
