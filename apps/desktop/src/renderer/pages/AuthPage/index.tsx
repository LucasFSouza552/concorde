import { useEffect, useState, type ChangeEvent } from "react";

import { Login } from "../../components/Auth/LoginComponent";
import { Register } from "../../components/Auth/RegisterComponent";
import { useAuth } from "../../contexts/AuthContext";

import styles from "./AuthPage.module.css";

interface RegisterForm {
    email: string;
    username: string;
    password: string;
    passwordConfirm: string;
}

export default function AuthPage() {

    const [authMode, setAuthMode] = useState<"login" | "register">("login");
    const [showPassword, setShowPassword] = useState(false);
    const { error } = useAuth();

    const [form, setForm] = useState<RegisterForm>({
        email: "",
        username: "",
        password: "",
        passwordConfirm: ""
    });

    const [errors, setErrors] = useState<Omit<RegisterForm, "passwordConfirm">>({
        email: "",
        username: "",
        password: "",
    });

    function handleChange(e: ChangeEvent<HTMLInputElement>) {
        const { name, value } = e.target;
        setForm((current) => ({
            ...current, [name as keyof RegisterForm]: value
        }))
    }

    function handleBoolChange(e: ChangeEvent<HTMLInputElement>) {
        setShowPassword(e.target.checked)
    }

    useEffect(() => {
        if (authMode == "login" || !form.passwordConfirm || form.password === form.passwordConfirm) {
            setErrors(errors => ({
                ...errors,
                password: ""
            }));

            return;
        }
        setErrors((errors) => ({ ...errors, password: "As senhas precisam coincidir." }))

    }, [form.password, form.passwordConfirm, authMode]);

    return (
        <main className={styles.container}>
            <div className={styles.panel}>

                <header>
                    <h1 className={styles.title}>Concorde</h1>
                </header>
                <div className={styles.toggle}>
                    <div className={styles.toggleIndicator}
                        data-mode={authMode} />
                    <button
                        className={`${styles.AuthBtn}`}
                        type="button"
                        disabled={authMode === "login"}
                        onClick={() => setAuthMode("login")}
                    >
                        Entrar
                    </button>
                    <button
                        className={styles.AuthBtn}
                        type="button"
                        disabled={authMode === "register"}
                        onClick={() => setAuthMode("register")}
                    >
                        Registrar
                    </button>
                </div>

                {authMode == "login" ?
                    <Login
                        email={form.email}
                        password={form.password}
                        handleChange={handleChange}
                        showPassword={showPassword}
                        handleBoolChange={handleBoolChange} /> :
                    <Register
                        email={form.email}
                        username={form.username}
                        password={form.password}
                        passwordConfirm={form.passwordConfirm}
                        handleChange={handleChange}
                        showPassword={showPassword}
                        handleBoolChange={handleBoolChange} />}
                <div>
                    {error && <p className={styles.formError} role="alert">{error}</p>}
                    {Object.entries(errors).map(([key, value]) => (
                        value && <span key={key}>{value}</span>
                    ))}

                </div>
            </div>
        </main>
    );

} 