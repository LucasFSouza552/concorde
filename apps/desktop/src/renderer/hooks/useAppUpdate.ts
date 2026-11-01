import { useEffect, useState } from "react";

export function useAppUpdate() {
    const [status, setStatus] = useState<UpdateStatus>({ state: "idle" });

    useEffect(() => {
        const updates = window.concorde?.updates;
        if (!updates) return;

        // Estado atual já existe? (a tela pode montar depois do evento do updater)
        void updates.getStatus?.().then((current) => {
            if (current) setStatus(current);
        }).catch(() => { });

        return updates.onStatus(setStatus);
    }, []);

    function quitAndInstall() {
        void window.concorde?.updates?.quitAndInstall();
    }

    return { status, quitAndInstall };
}
