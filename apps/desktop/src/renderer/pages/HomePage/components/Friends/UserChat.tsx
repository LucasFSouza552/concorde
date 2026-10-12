import styles from "./Friends.module.css";

interface UserChatProps {
    displayName: string;
    message: string;
}

export default function UserChat({ displayName, message }: UserChatProps) {
    const initial = displayName.trim().charAt(0).toUpperCase() || "?";

    return (
        <>
            <span className={styles.avatar}>
                {initial}
            </span>
            <span className={styles.identity}>
                <strong>{displayName}</strong>
                <small>{message}</small>
            </span>
        </>
    );
}