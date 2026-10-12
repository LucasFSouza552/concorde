import { useEffect, useState } from "react";
import { AppWindow, Monitor, ScreenShare, X } from "lucide-react";

import type { DesktopSource, ScreenQuality } from "@concorde/shared";

import styles from "./SourceModal.module.css";

interface SourceModalProps {
    onClose: () => void;
    onStart: (sourceId: string, quality: ScreenQuality, includeAudio: boolean) => void;
}

const resolutions = [
    { label: "480p", width: 854, height: 480 },
    { label: "720p", width: 1280, height: 720 },
    { label: "1080p", width: 1920, height: 1080 },
];

const frameRates = [15, 30, 60];

export default function SourceModal({ onClose, onStart }: SourceModalProps) {
    const [sources, setSources] = useState<DesktopSource[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<"screens" | "windows">("screens");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [shareAudio, setShareAudio] = useState(false);

    const [selectedRes, setSelectedRes] = useState(1);
    const [selectedFps, setSelectedFps] = useState(1);

    useEffect(() => {
        let cancelled = false;

        const bridge = window.concorde?.screenShare;
        console.log("bridge", bridge)

        if (!bridge) {
            setLoading(false);
            return;
        }

        bridge
            .getDesktopSources()
            .then((list) => {
                if (!cancelled) {
                    setSources(list);
                    setLoading(false);
                }
            }).catch(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        function handleKey(event: KeyboardEvent) {
            if (event.key === "Escape") onClose();
        }

        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [onClose]);

    const visible = sources.filter((s) =>
        tab === "screens" ? s.isScreen : !s.isScreen
    );

    const selectedIsWindow = selectedId?.startsWith("window:") ?? false;

    function handleSelect(sourceId: string) {
        setSelectedId(sourceId);

        if (!sourceId.startsWith("window:")) {
            setShareAudio(false);
        }
    }

    function handleStart() {
        if (!selectedId) return;

        const res = resolutions[selectedRes];
        onStart(
            selectedId,
            { width: res.width, height: res.height, frameRate: frameRates[selectedFps] },
            shareAudio && selectedIsWindow
        );

        onClose();
    }

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
                <header className={styles.header}>
                    <h2 className={styles.headerTitle}>Escolher o que compartilhar</h2>
                    <button type="button" className={styles.closeBtn} aria-label="Fechar" onClick={onClose}>
                        <X size={18} />
                    </button>
                </header>
                <nav className={styles.tabs} aria-label="Tipo de fonte">
                    <button
                        type="button"
                        className={`${styles.tab} ${tab === "screens" ? styles.tabSelected : ""}`}
                        aria-pressed={tab === "screens"}
                        onClick={() => setTab("screens")}
                    >
                        <Monitor size={14} /> Telas
                    </button>
                    <button
                        type="button"
                        className={`${styles.tab} ${tab === "windows" ? styles.tabSelected : ""}`}
                        aria-pressed={tab === "windows"}
                        onClick={() => setTab("windows")}
                    >
                        <AppWindow size={14} /> Janelas
                    </button>
                </nav>

                {loading && <span className={styles.hint}>Carregando telas e janelas...</span>}

                {!loading && visible.length === 0 && (
                    <span className={styles.hint}>Nenhuma fonte encontrada.</span>
                )}

                <div className={styles.grid}>
                    {visible.map((source) => (
                        <button
                            key={source.id}
                            type="button"
                            className={`${styles.source} ${selectedId === source.id ? styles.sourceSelected : ""}`}
                            aria-pressed={selectedId === source.id}
                            onClick={() => handleSelect(source.id)}
                        >
                            <img className={styles.thumbnail} src={source.thumbnail} alt={source.name} />
                            <span className={styles.sourceName}>{source.name}</span>
                        </button>
                    ))}
                </div>

                <label
                    className={`${styles.audioCard} ${shareAudio ? styles.audioCardOn : ""}`}
                    title={selectedIsWindow ? "Transmite o som da janela" : "Som disponível apenas para janelas"}
                >
                    <input
                        type="checkbox"
                        checked={shareAudio}
                        disabled={!selectedIsWindow}
                        onChange={(event) => setShareAudio(event.target.checked)}
                    />
                    <span>
                        <span className={styles.audioTitle}>Compartilhar som</span>
                        <span className={styles.audioSub}>
                            {selectedIsWindow
                                ? "Som da janela selecionada"
                                : "Disponível apenas para janelas"}
                        </span>
                    </span>
                </label>

                <div>
                    <span className={styles.sectionLabel}>Resolução</span>
                    <div className={styles.options}>
                        {resolutions.map((res, index) => (
                            <button
                                key={res.label}
                                type="button"
                                className={`${styles.option} ${selectedRes === index ? styles.optionSelected : ""}`}
                                aria-pressed={selectedRes === index}
                                onClick={() => setSelectedRes(index)}
                            >
                                {res.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div>
                    <span className={styles.sectionLabel}>FPS</span>
                    <div className={styles.options}>
                        {frameRates.map((fps, index) => (
                            <button
                                key={fps}
                                type="button"
                                className={`${styles.option} ${selectedFps === index ? styles.optionSelected : ""}`}
                                aria-pressed={selectedFps === index}
                                onClick={() => setSelectedFps(index)}
                            >
                                {fps}
                            </button>
                        ))}
                    </div>
                </div>

                <div className={styles.actions}>
                    <button
                        type="button"
                        className={styles.btnPrimary}
                        disabled={!selectedId}
                        onClick={handleStart}
                    >
                        <ScreenShare size={16} /> Transmitir
                    </button>
                </div>

            </div>
        </div>
    )
}