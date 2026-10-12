import type { LucideIcon } from "lucide-react";

import styles from "./NavigationButton.module.css";

interface NavigationProps {
    id: string;
    label: string;
    selected: boolean;
    icon: LucideIcon;
    handleClick: () => void;
};

export default function NavigationButton({ id, label, selected, icon: Icon, handleClick }: NavigationProps) {
    return (
        <button id={id} className={styles.content} onClick={handleClick} disabled={selected}>
            <Icon size={17} aria-hidden="true" />
            <span id={id} className={styles.label}>
                {label}
            </span>
        </button>);
}