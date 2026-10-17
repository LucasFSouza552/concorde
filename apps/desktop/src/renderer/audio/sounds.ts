
export type SoundName =
    | "startup"
    | "ring"
    | "micMute"
    | "micUnmute"
    | "deafenOn"
    | "join"
    | "leave";

interface Note {
    freq: number;
    at: number;
    dur: number;
    gain?: number;
    type?: OscillatorType;
}

const STORAGE_KEY = "concorde:audio";
const VOLUME = 1.5;

let context: AudioContext | null = null;

function getAudioContext(): AudioContext {
    if (!context) {
    context = new AudioContext({ sampleRate: 48000 });
    }
    if (context.state === "suspended") {
        void context.resume().catch(() => { });
    }
    return context;
}

function soundsEnabled(): boolean {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return true;
        return (JSON.parse(raw) as { soundsEnabled?: boolean }).soundsEnabled !== false;
    } catch {
        return true;
    }
}

function playNotes(notes: Note[]) {
    if (!soundsEnabled()) return;
    const ac = getAudioContext();
    const t0 = ac.currentTime;
    for (const note of notes) {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = note.type ?? "sine";
        osc.frequency.value = note.freq;
        const start = t0 + note.at;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime((note.gain ?? 0.16) * VOLUME, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + note.dur);
        osc.connect(gain).connect(ac.destination);
        osc.start(start);
        osc.stop(start + note.dur + 0.05);
    }
}

const SOUNDS: Record<SoundName, Note[]> = {
    startup: [
        { freq: 523.25, at: 0, dur: 0.45 },
        { freq: 659.25, at: 0.1, dur: 0.45 },
        { freq: 783.99, at: 0.2, dur: 0.6 },
    ],
    ring: [
        { freq: 659.25, at: 0, dur: 0.2, gain: 0.14 },
        { freq: 783.99, at: 0.22, dur: 0.2, gain: 0.14 },
        { freq: 659.25, at: 0.5, dur: 0.2, gain: 0.14 },
        { freq: 783.99, at: 0.72, dur: 0.2, gain: 0.14 },
    ],
    micMute: [
        { freq: 440, at: 0, dur: 0.1, gain: 0.12 },
        { freq: 329.63, at: 0.07, dur: 0.18, gain: 0.12 },
    ],
    micUnmute: [
        { freq: 329.63, at: 0, dur: 0.1, gain: 0.12 },
        { freq: 440, at: 0.07, dur: 0.18, gain: 0.12 },
    ],
    deafenOn: [
        { freq: 523.25, at: 0, dur: 0.1, gain: 0.12 },
        { freq: 349.23, at: 0.09, dur: 0.2, gain: 0.12 },
    ],
    join: [
        { freq: 392, at: 0, dur: 0.1, gain: 0.14 },
        { freq: 587.33, at: 0.08, dur: 0.22, gain: 0.14 },
    ],
    leave: [
        { freq: 587.33, at: 0, dur: 0.1, gain: 0.14 },
        { freq: 392, at: 0.08, dur: 0.26, gain: 0.14 },
    ],
};

export function playSound(name: SoundName) {
    playNotes(SOUNDS[name]);
}