import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

import styles from "./Modal.module.css";

interface ModalProps {
    title: string;
    onClose: () => void;
    children: ReactNode;
    width?: number;
}

export default function Modal({ title, onClose, children, width }: ModalProps) {
    useEffect(() => {
        function handleKey(event: KeyboardEvent) {
            if (event.key === "Escape") onClose();
        }

        window.addEventListener("keydown", handleKey);
        return () => {
            window.removeEventListener("keydown", handleKey);
        };
    }, [onClose]);

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div
                className={styles.modal}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                style={width ? { width } : undefined}
                onClick={(event) => event.stopPropagation()}
            >
                <header className={styles.header}>
                    <h2 className={styles.headerTitle}>{title}</h2>
                    <button type="button" className={styles.closeBtn} aria-label={`Fechar ${title}`} onClick={onClose}>
                        <X size={18} />
                    </button>
                </header>

                <div className={styles.body}>{children}</div>
            </div>
        </div>
    );
}
