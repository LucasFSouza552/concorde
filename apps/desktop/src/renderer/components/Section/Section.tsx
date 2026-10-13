import type { ReactNode } from "react";

import styles from "./Section.module.css";

interface SectionProps {
    title: string;
    description?: string;
    action?: ReactNode;
    children: ReactNode;
}

export default function Section({ title, children, action, description }: SectionProps) {
    return (
        <section className={styles.section}>
            <div className={styles.heading}>
                <div>
                    <h2 className={styles.title}>{title}</h2>
                    {description && <p className={styles.description}>{description}</p>}
                </div>
                {action}
            </div>
            {children}
        </section>
    )
}