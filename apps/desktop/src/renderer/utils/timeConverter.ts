
export function ConvertTimeStampToDateTime(epochTime: number) {
    const date = new Date(epochTime);
    const now = new Date();
    const time = date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });

    if (date.toDateString() === now.toDateString()) {
        return `Hoje, ${time}`;
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    if (date.toDateString() === yesterday.toDateString()) {
        return `Ontem, ${time}`;
    }

    return `${date.toLocaleDateString([])}, ${time}`;
}