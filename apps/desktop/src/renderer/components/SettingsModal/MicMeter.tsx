import { useEffect, useRef, useState, type ReactNode } from "react";

import styles from "./SettingsModal.module.css";

const SCALE = 500;

interface MicMeterProps {
    valueLabel: string;
    children: ReactNode;
}

export default function MicMeter({ valueLabel, children }: MicMeterProps) {
    const [testing, setTesting] = useState(false);
    const [level, setLevel] = useState(0);
    const stopRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        return () => {
            stopRef.current?.();
            stopRef.current = null;
        };
    }, []);

    async function start() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    noiseSuppression: false,
                    echoCancellation: true,
                },
                video: false,
            });

            const ctx = new AudioContext();
            if (ctx.state === "suspended") {
                await ctx.resume().catch(() => { });
            }

            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 512;
            source.connect(analyser);
            const buffer = new Uint8Array(analyser.fftSize);

            const timer = window.setInterval(() => {
                analyser.getByteTimeDomainData(buffer);
                let sum = 0;
                for (let i = 0; i < buffer.length; i++) {
                    const v = (buffer[i] - 128) / 128;
                    sum += v * v;
                }
                setLevel(Math.sqrt(sum / buffer.length));
            }, 100);

            stopRef.current = () => {
                window.clearInterval(timer);
                source.disconnect();
                stream.getTracks().forEach((track) => track.stop());
                void ctx.close().catch(() => { });
            };
            setTesting(true);
        } catch {
            setTesting(false);
        }
    }

    function stop() {
        stopRef.current?.();
        stopRef.current = null;
        setTesting(false);
        setLevel(0);
    }

    const fillPct = Math.min(100, Math.round(level * SCALE));

    return (
        <div className={styles.meterBlock}>
            <div className={styles.meterRow}>
                <button
                    type="button"
                    className={styles.meterBtn}
                    aria-pressed={testing}
                    onClick={() => (testing ? stop() : void start())}
                >
                    {testing ? "Parar teste" : "Testar microfone"}
                </button>
                <span className={styles.rangeValue}>{valueLabel}</span>
            </div>
            <div className={styles.meterOverlay}>
                <div
                    className={styles.meterTrack}
                    role="meter"
                    aria-label="Nível do microfone"
                    aria-valuenow={fillPct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                >
                    <div className={styles.meterFill} style={{ width: `${fillPct}%` }} />
                </div>
                {children}
            </div>
        </div>
    );
}