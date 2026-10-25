import type { ReactNode } from "react";

import styles from "./Page.module.css";

interface PageProps {
    children: ReactNode;
    hidden?: boolean;
    flush?: boolean;
    className?: string;
}

export default function Page({ children, hidden = false, flush = false, className }: PageProps) {
    const base = flush ? `${styles.page} ${styles.pageFlush}` : styles.page;
    const finalClass = className ? `${base} ${className}` : base;

    return <div hidden={hidden} className={finalClass} style={hidden ? { display: "none" } : undefined}>{children}</div>;
}
