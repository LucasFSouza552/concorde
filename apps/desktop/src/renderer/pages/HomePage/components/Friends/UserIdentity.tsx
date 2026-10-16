import styles from "./Friends.module.css";

interface UserIdentityProps {
    displayName: string;
    username: string;
    large?: boolean;
}

export default function UserIdentity({ displayName, username, large = false }: UserIdentityProps) {
    const initial = displayName.trim().charAt(0).toUpperCase() || "?";

    return (
        <>
            <span className={`${styles.avatar} ${large ? styles.avatarLarge : ""}`}>
                {initial}
            </span>
            <span className={styles.identity}>
                <strong className={large ? styles.nameLarge : ""}>{displayName}</strong>
                <small>@{username}</small>
            </span>
        </>
    );
}