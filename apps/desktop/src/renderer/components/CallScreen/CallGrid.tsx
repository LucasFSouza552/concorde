import type { CSSProperties, ReactNode } from "react";

import ParticipantTile from "./ParticipantTile";

import styles from "./CallScreen.module.css";

export interface GridTile {
    id: string;
    node: ReactNode;
}

interface CallGridProps {
    tiles: GridTile[];
    ringingNames?: string[];
}

const GAP_PX = 8;

function columnsFor(count: number): number {
    if (count <= 1) return 1;
    if (count <= 4) return 2;
    if (count <= 9) return 3;
    return 4;
}

export default function CallGrid({ tiles, ringingNames = [] }: CallGridProps) {
    const items: { key: string; node: ReactNode }[] = [
        ...tiles.map((tile) => ({ key: tile.id, node: tile.node })),
        ...ringingNames.map((name, index) => ({
            key: `ringing-${index}`,
            node: <ParticipantTile name={name} muted={false} ringing />,
        })),
    ];

    const columns = columnsFor(items.length);
    const rows: { key: string; node: ReactNode }[][] = [];

    for (let index = 0; index < items.length; index += columns) {
        rows.push(items.slice(index, index + columns));
    }

    const itemMax = columns === 1
        ? "min(100%, 960px)"
        : `calc((100% - ${GAP_PX * (columns - 1)}px) / ${columns})`;

    return (
        <div className={styles.grid} style={{ "--item-max": itemMax } as CSSProperties}>
            {rows.map((row, rowIndex) => (
                <div className={styles.gridRow} key={`row-${rowIndex}`}>
                    {row.map((item) => (
                        <div className={styles.gridItem} key={item.key}>
                            {item.node}
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}
