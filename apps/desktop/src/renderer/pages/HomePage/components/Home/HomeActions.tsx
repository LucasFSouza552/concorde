import { Phone, UserPlus, UsersRound } from "lucide-react";

import styles from "./Home.module.css";

interface HomeActionsProps {
    onAddFriend: () => void;
    onQuickCall: () => void;
    onCreateGroup: () => void;
}

export default function HomeActions({ onAddFriend, onQuickCall, onCreateGroup }: HomeActionsProps) {
    return (
        <div className={styles.quickActions}>
            <button type="button" className={styles.actionCard} onClick={onAddFriend}>
                <UserPlus size={22} aria-hidden="true" className={styles.actionIcon} />
                <span className={styles.actionText}>
                    <strong className={styles.actionTitle}>Adicionar Amigo</strong>
                    <small className={styles.actionSub}>Busque por nome de usuário</small>
                </span>
            </button>

            <button type="button" className={`${styles.actionCard} ${styles.actionPrimary}`} onClick={onQuickCall}>
                <Phone size={22} aria-hidden="true" className={styles.actionIcon} />
                <span className={styles.actionText}>
                    <strong className={styles.actionTitle}>Iniciar Chamada Rápida</strong>
                    <small className={styles.actionSub}>Áudio ou vídeo com um amigo</small>
                </span>
            </button>

            <button type="button" className={styles.actionCard} onClick={onCreateGroup}>
                <UsersRound size={22} aria-hidden="true" className={styles.actionIcon} />
                <span className={styles.actionText}>
                    <strong className={styles.actionTitle}>Criar Grupos</strong>
                    <small className={styles.actionSub}>Monte sua sala com o pessoal</small>
                </span>
            </button>
        </div>
    );
}
