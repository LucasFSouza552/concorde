import styles from "./Skeleton.module.css";

interface SkeletonProps {
    width?: number | string;
    height?: number | string;
    radius?: number | string;
    className?: string;
}

function dimension(value: number | string | undefined, fallback: string): string {
    if (value === undefined) return fallback;
    return typeof value === "number" ? `${value}px` : value;
}

export function Skeleton({ width, height = 14, radius, className }: SkeletonProps) {
    return (
        <span
            aria-hidden="true"
            className={`${styles.skeleton} ${className ?? ""}`.trim()}
            style={{ width: dimension(width, "100%"), height: dimension(height, "14px"), borderRadius: radius }}
        />
    );
}

export function SkeletonRow({ height = 36, className }: SkeletonProps) {
    return (
        <span aria-hidden="true" className={`${styles.row} ${className ?? ""}`.trim()} style={{ height: dimension(height, "36px") }}>
            <span className={styles.skeleton} style={{ width: height, height, borderRadius: "50%" }} />
            <span className={styles.skeleton} style={{ width: "46%", height: 12 }} />
        </span>
    );
}

export function SkeletonList({ rows = 3, rowHeight = 36, className }: { rows?: number; rowHeight?: number; className?: string }) {
    return (
        <span aria-hidden="true" className={styles.stack}>
            {Array.from({ length: rows }, (_, index) => (
                <SkeletonRow key={index} height={rowHeight} className={className} />
            ))}
        </span>
    );
}
