import { useEffect, useState } from "react";
import { AppWindow, Minimize2, Monitor, ScreenShare, X } from "lucide-react";
import { createPortal } from "react-dom";

import type { DesktopSource, ScreenQuality } from "@concorde/shared";

import styles from "./SourceModal.module.css";
import { Skeleton } from "../Skeleton/Skeleton";

interface SourceModalProps {
    onClose: () => void;
    onStart: (sourceId: string, quality: ScreenQuality, includeAudio: boolean, isWindow?: boolean) => void;
}

const resolutions = [
    { label: "480p", width: 854, height: 480 },
    { label: "720p", width: 1280, height: 720 },
    { label: "1080p", width: 1920, height: 1080 },
];

const frameRates = [15, 30, 60];

/**
 * Preferências persistidas do compartilhamento (aba/resolução/fps).
 * O checkbox de som NÃO é persistido de propósito: compartilhar áudio
 * exige consentimento explícito a cada início.
 */
const SHARE_PREFS_KEY = "concorde:share";

interface SharePrefs {
    tab?: "screens" | "windows";
    res?: number;
    fps?: number;
}

function loadSharePrefs(): SharePrefs {
    try {
        return JSON.parse(localStorage.getItem(SHARE_PREFS_KEY) ?? "{}") as SharePrefs;
    } catch {
        return {};
    }
}

function saveSharePrefs(prefs: SharePrefs) {
    try {
        localStorage.setItem(SHARE_PREFS_KEY, JSON.stringify(prefs));
    } catch { /* storage indisponível: segue default */ }
}

export default function SourceModal({ onClose, onStart }: SourceModalProps) {
    const saved = loadSharePrefs();

    const [sources, setSources] = useState<DesktopSource[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<"screens" | "windows">(saved.tab === "windows" ? "windows" : "screens");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [shareAudio, setShareAudio] = useState(false);

    const [selectedRes, setSelectedRes] = useState(
        saved.res !== undefined && saved.res >= 0 && saved.res < resolutions.length ? saved.res : 1
    );
    const [selectedFps, setSelectedFps] = useState(
        saved.fps !== undefined && saved.fps >= 0 && saved.fps < frameRates.length ? saved.fps : 1
    );

    useEffect(() => {
        saveSharePrefs({ tab, res: selectedRes, fps: selectedFps });
    }, [tab, selectedRes, selectedFps]);

    useEffect(() => {
        let cancelled = false;

        const bridge = window.concorde?.screenShare;

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
        !(s.name ?? "").toLowerCase().includes("concorde")
    ).filter((s) =>
        tab === "screens" ? s.isScreen : !s.isScreen
    );

    const selected = sources.find((s) => s.id === selectedId) ?? null;
    const selectedIsWindow = selected ? !selected.isScreen : false;

    function handleSelect(sourceId: string) {
        setSelectedId(sourceId);

        if (!sourceId.startsWith("window:")) {
            setShareAudio(false);
        }
    }

    function handleStart() {
        if (!selectedId || !selected) return;

        const res = resolutions[selectedRes];
        onStart(
            selectedId,
            { width: res.width, height: res.height, frameRate: frameRates[selectedFps] },
            shareAudio && selectedIsWindow,
            selectedIsWindow
        );

        onClose();
    }

    return createPortal(
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

                {loading && (
                    <div className={styles.grid}>
                        <Skeleton width="100%" height="78px" radius={10} />
                        <Skeleton width="100%" height="78px" radius={10} />
                        <Skeleton width="100%" height="78px" radius={10} />
                        <Skeleton width="100%" height="78px" radius={10} />
                    </div>
                )}

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
                            {source.minimized ? (
                                <span className={styles.thumbEmpty} aria-hidden="true">
                                    <Minimize2 size={22} />
                                    <span className={styles.thumbMinTag}>Minimizada</span>
                                </span>
                            ) : (
                                <img className={styles.thumbnail} src={source.thumbnail} alt={source.name} />
                            )}
                            <span className={styles.sourceName}>{source.name}</span>
                        </button>
                    ))}
                </div>

                {tab === "windows" && visible.some((s) => s.minimized) && (
                    <p className={styles.hint}>
                        Janelas minimizadas entram na chamada em branco — restaure e mexa nelas para o conteúdo aparecer.
                    </p>
                )}

                {tab === "windows" && (
                    <>
                        <label
                            className={`${styles.audioCard} ${shareAudio ? styles.audioCardOn : ""}`}
                            title="Transmite o som da janela"
                        >
                            <input
                                type="checkbox"
                                checked={shareAudio}
                                onChange={(event) => setShareAudio(event.target.checked)}
                            />
                            <span>
                                <span className={styles.audioTitle}>Compartilhar som</span>
                                <span className={styles.audioSub}>Som do programa selecionado</span>
                            </span>
                        </label>
                        {shareAudio && selectedIsWindow && (
                            <p className={styles.hint} role="alert">
                                O som capturado é o do programa selecionado (todas as janelas e abas dele),
                                não apenas desta janela — mas nunca o áudio de outros programas ou do sistema.
                                Evite programas que emitam a própria chamada e prefira usar fones; sem isso,
                                o áudio realimenta e o volume pode disparar.
                            </p>
                        )}
                    </>
                )}

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
        </div>,
        document.body
    )
}