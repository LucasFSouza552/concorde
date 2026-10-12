import { useEffect, useState } from "react";

export function useAppUpdate() {
    const [status, setStatus] = useState<UpdateStatus>({ state: "idle" });

    useEffect(() => {
        const updates = window.concorde?.updates;
        if (!updates) return;
        return updates.onStatus(setStatus);
    }, []);

    function quitAndInstall() {
        void window.concorde?.updates?.quitAndInstall();
    }

    return { status, quitAndInstall };
}
