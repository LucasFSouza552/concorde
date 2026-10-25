import { useEffect, useState } from "react";
import { Moon, RotateCcw, Sun, Sunrise } from "lucide-react";

import Page from "../../../../components/Page/Page";
import AddFriendModal from "./AddFriendModal";
import CreateGroupModal from "./CreateGroupModal";
import HomeActions from "./HomeActions";
import QuickCallModal from "./QuickCallModal";
import { useUI } from "../../../../contexts/UIContext";
import { useAuth } from "../../../../contexts/AuthContext";

import { useFriendsList } from "../../../../hooks/useFriendsList";
import { useGroupsList } from "../../../../hooks/useGroupsList";

import styles from "./Home.module.css";
import logoUrl from "../../../../assets/concorde.ico";

type HomeModal = "addFriend" | "quickCall" | "createGroup" | null;
type DayPhase = "dawn" | "day" | "night";

function dayPhase(hour: number): DayPhase {
    if (hour >= 5 && hour < 12) return "dawn";
    if (hour >= 12 && hour < 18) return "day";
    return "night";
}

const GREETING: Record<DayPhase, string> = {
    dawn: "Bom dia",
    day: "Boa tarde",
    night: "Boa noite",
};

export default function Home() {
    const { friends } = useFriendsList();
    const { load: reloadGroups } = useGroupsList();
    const { setSidebarOpen, sidebarOpen } = useUI();
    const { user } = useAuth();
    const [modal, setModal] = useState<HomeModal>(null);
    const [now, setNow] = useState(() => new Date());
    /** escolha de ambiente: auto segue o horário do relógio; o resto é fixado */
    const [phaseChoice, setPhaseChoice] = useState<"auto" | DayPhase>(() => {
        try {
            const saved = localStorage.getItem("concorde.dayPhase");
            if (saved === "dawn" || saved === "day" || saved === "night" || saved === "auto") return saved;
        } catch {
            /* ignore */
        }
        return "auto";
    });

    /** incrementado a cada escolha manual para pulse suave por cima do cross-fade */
    const [manualTick, setManualTick] = useState(0);

    function choosePhase(next: "auto" | DayPhase) {
        setManualTick((tick) => tick + 1);
        setPhaseChoice(next);
        try {
            localStorage.setItem("concorde.dayPhase", next);
        } catch {
            /* ignore */
        }
    }

    useEffect(() => {
        const timer = window.setInterval(() => setNow(new Date()), 30_000);
        return () => window.clearInterval(timer);
    }, []);

    const phase = phaseChoice === "auto" ? dayPhase(now.getHours()) : phaseChoice;
    // Saudação segue o horário real do relógio; o ambiente é só visual.
    const greetingPhase = dayPhase(now.getHours());
    const dateLabel = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(now);
    const timeLabel = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(now);
    const firstName = user?.displayName?.trim().split(" ")[0] ?? "";

    return (
        <Page className={styles.phaseStage}>
            {/* camadas empilhadas: a ativa com opacity 1 e o cross-fade (800ms) faz a mistura;
                escolha manual dispara um clarão suave por cima sem interromper o fundo */}
            <div className={styles.phaseBackdrop} aria-hidden="true">
                <div className={`${styles.phaseLayer} ${styles.startDawn} ${phase === "dawn" ? styles.phaseLayerOn : ""}`.trim()} />
                <div className={`${styles.phaseLayer} ${styles.startDay} ${phase === "day" ? styles.phaseLayerOn : ""}`.trim()} />
                <div className={`${styles.phaseLayer} ${styles.startNight} ${phase === "night" ? styles.phaseLayerOn : ""}`.trim()} />
                {manualTick > 0 && <div key={manualTick} className={styles.phaseFlash} />}
            </div>
            <div className={styles.start}>
                <div className={`${styles.startClock} ${sidebarOpen ? "" : styles.startClockShift}`}>
                    <span className={styles.startClockDate}>{dateLabel}</span>
                    <time className={styles.startClockTime}>{timeLabel}</time>
                </div>

                <div className={styles.phaseSwitch} role="group" aria-label="Ambiente da tela inicial">
                    <span className={styles.phaseSwitchLabel}>Ambiente:</span>
                    <button
                        type="button"
                        className={`${styles.phaseBtn} ${phaseChoice === "dawn" ? styles.phaseBtnActive : ""}`.trim()}
                        onClick={() => choosePhase("dawn")}
                    >
                        <Sunrise size={13} /> Manhã
                    </button>
                    <button
                        type="button"
                        className={`${styles.phaseBtn} ${phaseChoice === "day" ? styles.phaseBtnActive : ""}`.trim()}
                        onClick={() => choosePhase("day")}
                    >
                        <Sun size={13} /> Tarde
                    </button>
                    <button
                        type="button"
                        className={`${styles.phaseBtn} ${phaseChoice === "night" ? styles.phaseBtnActive : ""}`.trim()}
                        onClick={() => choosePhase("night")}
                    >
                        <Moon size={13} /> Noite
                    </button>
                    <button
                        type="button"
                        className={`${styles.phaseBtn} ${phaseChoice === "auto" ? styles.phaseBtnActive : ""}`.trim()}
                        title="Seguir o horário do computador"
                        onClick={() => choosePhase("auto")}
                    >
                        <RotateCcw size={13} /> Auto
                    </button>
                </div>

                <header className={styles.startHeader}>
                    <img src={logoUrl} alt="Logo do Concorde" className={styles.startLogo} draggable={false} />
                    <h1 className={styles.startTitle}>Concorde</h1>
                    <p className={styles.startGreeting}>
                        {GREETING[greetingPhase]}
                        {firstName ? `, ${firstName}` : ""}
                    </p>
                    <p className={styles.startSub}>O que você quer fazer agora?</p>
                </header>

                <HomeActions
                    onAddFriend={() => setModal("addFriend")}
                    onStartChat={() => setSidebarOpen(true)}
                    onQuickCall={() => setModal("quickCall")}
                    onCreateGroup={() => setModal("createGroup")}
                />
            </div>

            {modal === "addFriend" && <AddFriendModal onClose={() => setModal(null)} />}
            {modal === "quickCall" && <QuickCallModal friends={friends} onClose={() => setModal(null)} />}
            {modal === "createGroup" && (
                <CreateGroupModal onClose={() => setModal(null)} onCreated={() => void reloadGroups()} />
            )}

        </Page>
    )
}
