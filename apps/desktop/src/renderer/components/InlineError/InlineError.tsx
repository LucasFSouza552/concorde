import styles from "./InlineError.module.css";

interface InlineErrorProps {
    message: string;
    onRetry?: () => void;
}

export default function InlineError({ message, onRetry }: InlineErrorProps) {
    return (
        <div className={styles.error} role="alert">
            <span className={styles.message}>{message}</span>
            {onRetry && (
                <button type="button" className={styles.retryBtn} onClick={onRetry}>
                    Tentar de novo
                </button>
            )}
        </div>
    );
}