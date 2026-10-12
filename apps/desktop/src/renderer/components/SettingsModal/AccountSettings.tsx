import { useAuth } from "../../contexts/AuthContext"

import styles from "./SettingsModal.module.css";

export default function AccountSettings() {
    const { user, logout } = useAuth();
    const initial = (user?.displayName ?? "?").trim().charAt(0).toUpperCase();

    return (
        <section className={styles.panel}>
            <h3 className={styles.panelTitle}>Conta</h3>
            <p className={styles.panelDesc}>Suas informações neste dispositivo.</p>
            <div className={styles.profileRow}>
                <span className={styles.profileAvatar} aria-hidden="true">{initial}</span>
                <div>
                    <p className={styles.profileName}>{user?.displayName}</p>
                    <p className={styles.profileUser}>@{user?.username}</p>
                </div>
            </div>
            <button type="button" className={styles.dangerBtn} onClick={logout}>
                Sair da conta
            </button>
        </section>
    );
}