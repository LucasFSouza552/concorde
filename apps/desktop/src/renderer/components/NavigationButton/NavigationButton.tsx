import type { LucideIcon } from "lucide-react";

import styles from "./NavigationButton.module.css";

interface NavigationProps {
    id: string;
    label: string;
    selected: boolean;
    icon: LucideIcon;
    handleClick: () => void;
    badge?: number;
};

export default function NavigationButton({ id, label, selected, icon: Icon, handleClick, badge = 0 }: NavigationProps) {
    return (
        <button id={id} className={styles.content} onClick={handleClick} disabled={selected}>
            <Icon size={17} aria-hidden="true" />
            <span id={id} className={styles.label}>
                {label}
            </span>
            {badge > 0 && (
                <span className={styles.badge} aria-label={`${badge} pendentes`}>
                    {badge > 99 ? "99+" : badge}
                </span>
            )}
        </button>);
}