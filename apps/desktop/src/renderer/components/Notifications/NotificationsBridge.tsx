import { useEffect, useRef } from "react";

import { useCallInviteState, type CallInviteState } from "../../contexts/CallInviteProvider";
/**
 * Ponte de notificações do Windows: enquanto o app está escondido/em
 * segundo plano, uma chamada pendente gera banner nativo (clicável) e
 * badge na barra de tarefas — que somem quando a chamada se resolve.
 *
 * Em campanha de grupo chega um convite por membro: só o primeiro
 * convite de cada chamador notifica (nada de tempestade de banners).
 */
export default function NotificationsBridge() {
    const { incoming, waiting } = useCallInviteState() as CallInviteState;

    // Último chamador notificado — rastreado por usuário, não por callId:
    // as ligaçãoes de grupo reincidem em callIds diferentes do mesmo autor.
    const lastNotifiedUserRef = useRef<string | null>(null);

    // Badge enquanto houver chamada pendente.
    useEffect(() => {
        void window.concorde.app.setBadge(Boolean(incoming || waiting)).catch(() => { });
    }, [incoming, waiting]);

    // Banner nativo só quando a janela não está em primeiro plano —
    // a decisão final fica no processo principal (estado real da janela).
    useEffect(() => {
        const invite = incoming ?? waiting;

        if (invite) {
            if (invite.fromUserId === lastNotifiedUserRef.current) return;

            lastNotifiedUserRef.current = invite.fromUserId;

            void window.concorde.app.notifyCall(invite.fromDisplayName)
                .then((result) => {
                    if (!result.notified) {
                        console.info("[notific] janela já em primeiro plano — banner pulado");
                    }
                })
                .catch((error) => {
                    console.warn("[notific] falha ao notificar chamada:", error);
                });
            return;
        }

        if (!lastNotifiedUserRef.current) return;

        lastNotifiedUserRef.current = null;
        void window.concorde.app.notifyCancel().catch(() => { });
    }, [incoming, waiting]);

    return null;
}
