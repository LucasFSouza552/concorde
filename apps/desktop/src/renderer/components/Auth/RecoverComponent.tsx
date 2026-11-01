import { useState } from "react";
import { KeyRound, Mail, ShieldCheck } from "lucide-react";

import { isValidEmail } from "@concorde/shared";

import { api, getErrorMessage } from "../../api/api";
import FormInput from "../Form/Input/FormInput";

import styles from "./AuthComponent.module.css";

type RecoverStep = "email" | "code" | "done";

interface RecoverProps {
    email: string;
    handleChange: React.ChangeEventHandler<HTMLInputElement>;
    onBack: () => void;
}

export function Recover({ email, handleChange, onBack }: RecoverProps) {
    const [step, setStep] = useState<RecoverStep>("email");
    const [code, setCode] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSendCode(e: React.SubmitEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);

        if (!isValidEmail(email)) {
            setError("Informe um email válido.");
            return;
        }

        setBusy(true);

        try {
            await api.post("/auth/forgot-password", { email });
        } catch (submitError) {
            // Mesmo com falha (ex.: rate limit), mostramos o erro real.
            setError(getErrorMessage(submitError) ?? "Não foi possível enviar o código.");
            setBusy(false);
            return;
        }

        setStep("code");
        setBusy(false);
    }

    async function handleResetPassword(e: React.SubmitEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);

        if (newPassword.length < 6) {
            setError("A nova senha precisa de pelo menos 6 caracteres.");
            return;
        }

        if (newPassword !== newPasswordConfirm) {
            setError("As senhas precisam coincidir.");
            return;
        }

        setBusy(true);

        try {
            await api.post("/auth/reset-password", { email, code, newPassword });
            setStep("done");
        } catch (submitError) {
            setError(getErrorMessage(submitError) ?? "Código inválido ou expirado.");
        } finally {
            setBusy(false);
        }
    }

    const backBtn = (
        <button type="button" className={styles.forgotBtn} onClick={onBack}>
            Voltar ao login
        </button>
    );

    if (step === "email") {
        return (
            <form className={styles.form} onSubmit={handleSendCode}>
                <p className={styles.recoverHint}>
                    <ShieldCheck size={14} aria-hidden="true" />
                    <span>Enviaremos um código de 6 dígitos para o seu email.</span>
                </p>

                <FormInput id="email" type="email" icon={Mail} placeholder="Email" value={email} handleChange={handleChange} />

                {error && <p className={styles.recoverError} role="alert">{error}</p>}

                <button type="submit" className={styles.submitBtn} disabled={busy}>
                    <Mail size={16} aria-hidden="true" />
                    <span>{busy ? "Enviando..." : "Enviar código"}</span>
                </button>

                {backBtn}
            </form>
        );
    }

    if (step === "code") {
        return (
            <form className={styles.form} onSubmit={handleResetPassword}>
                <p className={styles.recoverHint}>
                    <ShieldCheck size={14} aria-hidden="true" />
                    <span>Digite o código recebido por email e a nova senha.</span>
                </p>

                <FormInput
                    id="resetCode"
                    type="text"
                    icon={ShieldCheck}
                    placeholder="Código"
                    value={code}
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="one-time-code"
                    handleChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                />
                <FormInput
                    id="newPassword"
                    type="password"
                    icon={KeyRound}
                    placeholder="Nova senha"
                    value={newPassword}
                    showPassword={true}
                    handleChange={(event) => setNewPassword(event.target.value)}
                />
                <FormInput
                    id="newPasswordConfirm"
                    type="password"
                    icon={KeyRound}
                    placeholder="Confirmar nova senha"
                    value={newPasswordConfirm}
                    showPassword={true}
                    handleChange={(event) => setNewPasswordConfirm(event.target.value)}
                />

                {error && <p className={styles.recoverError} role="alert">{error}</p>}

                <button type="submit" className={styles.submitBtn} disabled={busy || code.length !== 6 || !newPassword || !newPasswordConfirm}>
                    <KeyRound size={16} aria-hidden="true" />
                    <span>{busy ? "Salvando..." : "Redefinir senha"}</span>
                </button>

                {backBtn}
            </form>
        );
    }

    return (
        <div className={styles.form}>
            <p className={styles.recoverHint}>
                <ShieldCheck size={14} aria-hidden="true" />
                <span>Senha redefinida! Entre com a nova senha.</span>
            </p>
            {backBtn}
        </div>
    );
}
