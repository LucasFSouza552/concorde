import { useState, type ChangeEvent } from "react";
import { type LucideIcon } from "lucide-react";

import styles from "./FormInput.module.css";

interface FormInputProps {
    id: string;
    type: "text" | "email" | "password";
    icon: LucideIcon;
    placeholder?: string;
    value: string
    showPassword?: boolean
    /** Extras para casos como o código TOTP (2FA). */
    inputMode?: "numeric" | "text";
    maxLength?: number;
    autoComplete?: string;
    handleChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

export default function FormInput({ id, type, icon: Icon, placeholder, value, handleChange, showPassword = true, inputMode, maxLength, autoComplete }: FormInputProps) {
    const [focused, setFocused] = useState(false);

    const floating = focused || value.length > 0;

    return (
        <div className={styles.inputWrap}>

            <Icon className={styles.inputIcon} size={18} aria-hidden="true" />

            <label
                htmlFor={id}
                className={`${styles.label} ${floating ? styles.floating : ""}`}
            >
                {placeholder}
            </label>

            <input
                id={id}
                name={id}
                className={styles.field}
                type={type === "password" && showPassword ? "text" : type}
                value={value}
                onChange={handleChange}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                inputMode={inputMode}
                maxLength={maxLength}
                autoComplete={autoComplete}
            />
        </div>
    )
}