
export type SensitivityMode = "auto" | "manual" | "off";

export interface SensitivityOptions {
    mode?: SensitivityMode;
    manualThreshold?: number;
    marginDb?: number;
    hangoverMs?: number;
}

export interface GateState {
    level: number;
    threshold: number;
    open: boolean;
}

const DEFAULTS = {
    mode: "auto" as SensitivityMode,
    manualThreshold: 0.08,
    marginDb: 12,
    hangoverMs: 300,
};

const AUTO_FLOOR_MIN = 0.005;
const AUTO_FLOOR_MAX = 0.3;
const AUTO_THRESHOLD_MIN = 0.02;
const AUTO_THRESHOLD_MAX = 0.5;
const LEVEL_SMOOTHING = 0.4;
const FLOOR_ATTACK = 0.15;
const FLOOR_RELEASE = 0.002;

export function resolveThreshold(mode: SensitivityMode, manualThreshold: number, floor: number): number {
    if (mode === "manual") {
        return manualThreshold;
    }
    const multiplier = Math.pow(10, DEFAULTS.marginDb / 20);
    return Math.min(AUTO_THRESHOLD_MAX, Math.max(AUTO_THRESHOLD_MIN, floor * multiplier));
}

export function smoothLevel(previous: number, rms: number): number {
    return previous + (rms - previous) * LEVEL_SMOOTHING;
}

export function adaptFloor(previous: number, rms: number): number {
    const rate = rms < previous ? FLOOR_ATTACK : FLOOR_RELEASE;
    const next = previous + (rms - previous) * rate;
    return Math.min(AUTO_FLOOR_MAX, Math.max(AUTO_FLOOR_MIN, next));
}

export interface GateDecisionInput {
    level: number;
    threshold: number;
    mode: SensitivityMode;
    now: number;
    hangoverUntil: number;
    hangoverMs: number;
}

export interface GateDecision {
    open: boolean;
    hangoverUntil: number;
}

export function decideGateOpen(input: GateDecisionInput): GateDecision {
    if (input.mode === "off") {
        return { open: true, hangoverUntil: input.hangoverUntil };
    }
    if (input.level > input.threshold) {
        return { open: true, hangoverUntil: input.now + input.hangoverMs };
    }
    if (input.now >= input.hangoverUntil) {
        return { open: false, hangoverUntil: input.hangoverUntil };
    }
    return { open: true, hangoverUntil: input.hangoverUntil };
}

export class SensitivityGate {
    private context?: AudioContext;
    private analyser?: AnalyserNode;
    private data?: Uint8Array<ArrayBuffer>;
    private timer?: ReturnType<typeof setInterval>;

    private level = 0;
    private floor = 0.02;
    private open = true;
    private hangoverUntil = 0;

    private options = { ...DEFAULTS };
    onChange?: (open: boolean) => void;

    constructor(options: SensitivityOptions = {}) {
        this.setOptions(options);
    }

    setOptions(patch: SensitivityOptions): void {
        const clean = Object.fromEntries(
            Object.entries(patch).filter(([, v]) => v !== undefined)
        );
        Object.assign(this.options, clean);
    }

    getState(): GateState {
        return {
            level: this.level,
            threshold: this.currentThreshold(),
            open: this.open
        };
    }

    private currentThreshold(): number {
        if (this.options.mode === "manual") {
            return this.options.manualThreshold;
        }
        return resolveThreshold(this.options.mode, this.options.manualThreshold, this.floor);
    }

    async connect(stream: MediaStream): Promise<void> {
        this.destroy();

        this.context = new AudioContext();
        const source = this.context.createMediaStreamSource(stream);
        this.analyser = this.context.createAnalyser();
        this.analyser.fftSize = 512;
        source.connect(this.analyser);
        this.data = new Uint8Array(this.analyser.fftSize);

        if (this.context.state === "suspended") {
            await this.context.resume();
        }

        this.open = true;
        this.hangoverUntil = performance.now() + this.options.hangoverMs;
        this.timer = setInterval(() => this.tick(), 50);
    }

    private tick(): void {
        if (!this.analyser || !this.data) return;

        this.analyser.getByteTimeDomainData(this.data);

        let sum = 0;
        for (let i = 0; i < this.data.length; i++) {
            const normalized = (this.data[i] - 128) / 128;
            sum += normalized * normalized;
        }
        const rms = Math.sqrt(sum / this.data.length);
        this.level = smoothLevel(this.level, rms);
        this.floor = adaptFloor(this.floor, rms);

        const decision = decideGateOpen({
            level: this.level,
            threshold: this.currentThreshold(),
            mode: this.options.mode,
            now: performance.now(),
            hangoverUntil: this.hangoverUntil,
            hangoverMs: this.options.hangoverMs,
        });
        this.hangoverUntil = decision.hangoverUntil;
        this.setOpen(decision.open);
    }

    private setOpen(value: boolean): void {
        if (value === this.open) return;
        this.open = value;
        this.onChange?.(value);
    }

    destroy(): void {
        if (this.timer !== undefined) {
            clearInterval(this.timer);
            this.timer = undefined;
        }
        if (this.context) {
            void this.context.close();
            this.context = undefined;
        }
        this.analyser = undefined;
        this.data = undefined;
        this.onChange = undefined;
    }
}