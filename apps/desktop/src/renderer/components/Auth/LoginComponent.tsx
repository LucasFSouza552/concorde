import { useState, type ChangeEvent } from "react";
import { KeyRound, LogIn, Mail, ShieldCheck } from "lucide-react";

import { useAuth } from "../../contexts/AuthContext";
import FormCheckbox from "../Form/CheckBox/FormCheckbox";
import FormInput from "../Form/Input/FormInput";

import styles from "./AuthComponent.module.css";

interface LoginProps {
    email: string;
    password: string;
    handleChange: (e: ChangeEvent<HTMLInputElement>) => void;
    showPassword: boolean;
    handleBoolChange: (e: ChangeEvent<HTMLInputElement>) => void;
    onForgotPassword: () => void;
}

export function Login({ email, password, handleChange, showPassword, handleBoolChange, onForgotPassword }: LoginProps) {
    const { login, awaitingTotp } = useAuth();
    const [totpCode, setTotpCode] = useState("");

    const totpStage = awaitingTotp !== null;

    async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
        e.preventDefault();

        if (!email || !password) {
            return;
        }

        await login({ email, password, totp: totpStage ? totpCode : undefined });
    }

        return (
        <form className={styles.form} onSubmit={handleSubmit}>

            <FormInput id="email" type="email" icon={Mail} placeholder="Email" value={email} handleChange={handleChange} />
            <FormInput id="password" type="password" icon={KeyRound} placeholder="Senha" value={password} handleChange={handleChange} showPassword={showPassword} />

            {totpStage && (
                <>
                    <p className={styles.totpHint}>
                        <ShieldCheck size={14} aria-hidden="true" />
                        <span>Digite o código do app autenticador</span>
                    </p>
                    <FormInput
                        id="totp"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        icon={ShieldCheck}
                        placeholder="000000"
                        value={totpCode}
                        handleChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                    />
                </>
            )}

            <FormCheckbox checked={showPassword} label="Mostrar Senha" onChange={handleBoolChange} id="showPassword" />

            <button type="submit" className={styles.submitBtn}>
                <LogIn size={16} aria-hidden="true" />
                <span>{totpStage ? "Verificar código" : "Entrar"}</span>
            </button>

            <button type="button" className={styles.forgotBtn} onClick={onForgotPassword}>
                Esqueci minha senha
            </button>
        </form>
    );
}