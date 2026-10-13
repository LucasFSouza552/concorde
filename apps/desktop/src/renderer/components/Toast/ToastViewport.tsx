import { X } from "lucide-react";

import { useToast } from "../../contexts/ToastProvider";

import styles from "./Toast.module.css";

export default function ToastViewPort() {
    const { toasts, dismiss } = useToast();

    if (toasts.length === 0) return null;

    return (
        <div className={styles.viewport} aria-live="polite">
            {toasts.map((toast) => (
                <div key={toast.id} className={`${styles.toast} ${styles[toast.type]}`}>
                    <span className={styles.message}>{toast.message}</span>
                    <button type="button" className={styles.closeBtn} aria-label="Dispensar notificação" onClick={() => dismiss(toast.id)}>
                        <X size={14} />
                    </button>
                </div>
            ))}
        </div>
    )
}