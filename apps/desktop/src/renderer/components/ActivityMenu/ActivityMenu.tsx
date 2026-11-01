import { Phone, PhoneOutgoing } from "lucide-react";

import type { ActiveCallEntry } from "../../hooks/useActiveCalls";

import styles from "./ActivityMenu.module.css";

interface ActivityMenuProps {
    calls: ActiveCallEntry[];
    onSelectCall: (call: ActiveCallEntry) => void;
}

// Menu de atividade no canto superior esquerdo da tela inicial: fica oculto
// quando não há nada acontecendo e lista chamadas ativas nos seus grupos
// (e sua DM atual). Clicar em um item entra (ou volta) para a chamada.
export default function ActivityMenu({ calls, onSelectCall }: ActivityMenuProps) {
    if (calls.length === 0) return null;

    return (
        <div className={styles.activity} aria-label="Menu de atividade">
            <div className={styles.panel}>
                {calls.map((call) => (
                    <button
                        key={call.key}
                        type="button"
                        role="menuitem"
                        className={`${styles.row} ${call.isCurrent ? styles.rowCurrent : ""}`}
                        onClick={() => onSelectCall(call)}
                    >
                        <span className={styles.avatar} aria-hidden="true">
                            {call.title.trim().charAt(0).toUpperCase()}
                        </span>
                        <span className={styles.text}>
                            <span className={styles.title} title={call.title}>{call.title}</span>
                            <span className={styles.subtitle}>{call.subtitle}</span>
                        </span>
                        {call.isCurrent ? (
                            <span className={styles.tag}>
                                <Phone size={14} aria-hidden="true" /> Voltar
                            </span>
                        ) : (
                            <span className={styles.mutedTag}>
                                <PhoneOutgoing size={14} aria-hidden="true" /> Entrar
                            </span>
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
}
