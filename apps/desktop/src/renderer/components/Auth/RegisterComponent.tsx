import type { ChangeEvent } from "react";
import type React from "react";
import { KeyRound, Mail, User, UserPlus } from "lucide-react";

import { isValidEmail } from "@concorde/shared";
import { useAuth } from "../../contexts/AuthContext";
import FormCheckbox from "../Form/CheckBox/FormCheckbox";
import FormInput from "../Form/Input/FormInput";

import styles from "./AuthComponent.module.css";

interface RegisterProps {
    email: string;
    username: string;
    password: string;
    passwordConfirm: string;
    handleChange: (e: ChangeEvent<HTMLInputElement>) => void;
    showPassword: boolean;
    handleBoolChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

export function Register({ email, username, password, passwordConfirm, showPassword, handleBoolChange, handleChange }: RegisterProps) {

    const { register } = useAuth();

    async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
        e.preventDefault();

        if (!isValidEmail(email)) {
            return;
        }

        if (password !== passwordConfirm) {
            return;
        }

        await register({ username, email, password });
    }

    return (
        <form className={styles.form} onSubmit={handleSubmit}>
            <FormInput id="email" type="email" icon={Mail} placeholder="Email" handleChange={handleChange} value={email} />
            <FormInput id="username" type="text" icon={User} placeholder="Apelido" handleChange={handleChange} value={username} />
            <FormInput id="password" type="password" icon={KeyRound} placeholder="Senha" handleChange={handleChange} value={password} showPassword={showPassword} />
            <FormInput id="passwordConfirm" type="password" icon={KeyRound} placeholder="Confirmar Senha" handleChange={handleChange} value={passwordConfirm} showPassword={showPassword} />

            <FormCheckbox checked={showPassword} label="Mostrar Senha" onChange={handleBoolChange} id="showPassword" />

            <button type="submit" className={styles.submitBtn}>
                <UserPlus size={16} aria-hidden="true" />
                <span>Criar conta</span>
            </button>
        </form>
    )
}