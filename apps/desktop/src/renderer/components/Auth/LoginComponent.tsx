import { type ChangeEvent } from "react";
import { KeyRound, LogIn, Mail } from "lucide-react";

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
}

export function Login({ email, password, handleChange, showPassword, handleBoolChange }: LoginProps) {
    const { login } = useAuth();

    async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
        e.preventDefault();

        if (!email) {
            return;
        }

        if (!password) {
            return;
        }

        await login({ email, password });
    }

    return (
        <form className={styles.form} onSubmit={handleSubmit}>

            <FormInput id="email" type="email" icon={Mail} placeholder="Email" value={email} handleChange={handleChange} />
            <FormInput id="password" type="password" icon={KeyRound} placeholder="Senha" value={password} handleChange={handleChange} showPassword={showPassword} />

            <FormCheckbox checked={showPassword} label="Mostrar Senha" onChange={handleBoolChange} id="showPassword" />

            <button type="submit" className={styles.submitBtn}>
                <LogIn size={16} aria-hidden="true" />
                <span>Entrar</span>
            </button>
        </form>
    );
}