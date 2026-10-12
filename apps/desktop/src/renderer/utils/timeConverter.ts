
export function ConvertTimeStampToHM(epochTime: number) {
    const time = new Date(epochTime).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });

    return time;
}