import styles from "./Friends.module.css";

interface UserIdentityProps {
    displayName: string;
    username: string;
}

export default function UserIdentity({ displayName, username }: UserIdentityProps) {
    const initial = displayName.trim().charAt(0).toUpperCase() || "?";

    return (
        <>
            <span className={styles.avatar}>
                {initial}
            </span>
            <span className={styles.identity}>
                <strong>{displayName}</strong>
                <small>@{username}</small>
            </span>
        </>
    );
}