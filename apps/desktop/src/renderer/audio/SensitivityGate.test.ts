import { describe, expect, it } from "vitest";

import {
    adaptFloor,
    decideGateOpen,
    resolveThreshold,
    smoothLevel,
} from "./SensitivityGate";

describe("resolveThreshold", () => {
    it("modo manual usa o valor do usuário, sem adaptação", () => {
        expect(resolveThreshold("manual", 0.2, 0.005)).toBe(0.2);
        expect(resolveThreshold("manual", 0.01, 0.3)).toBe(0.01);
    });

    it("modo auto deriva do chão com margem e limites", () => {
        expect(resolveThreshold("auto", 0.08, 0.01)).toBeCloseTo(0.0398, 3);
        expect(resolveThreshold("auto", 0.08, 0)).toBe(0.02);
        expect(resolveThreshold("auto", 0.08, 10)).toBe(0.5);
    });
});

describe("smoothLevel e adaptFloor", () => {
    it("nível converge rápido para o rms", () => {
        expect(smoothLevel(0, 0.1)).toBeCloseTo(0.04, 5);
    });

    it("chão desce rápido no silêncio e sobe devagar no barulho", () => {
        const falling = adaptFloor(0.1, 0.01);
        const rising = adaptFloor(0.01, 0.1);
        expect(0.1 - falling).toBeGreaterThan(rising - 0.01);
    });

    it("chão respeita os limites", () => {
        expect(adaptFloor(0, 0)).toBe(0.005);
        expect(adaptFloor(10, 10)).toBe(0.3);
    });
});

describe("decideGateOpen", () => {
    const base = {
        threshold: 0.08,
        mode: "manual" as const,
        now: 10_000,
        hangoverUntil: 0,
        hangoverMs: 300,
    };

    it("abre acima do threshold e agenda hangover", () => {
        const decision = decideGateOpen({ ...base, level: 0.1 });
        expect(decision.open).toBe(true);
        expect(decision.hangoverUntil).toBe(10_300);
    });

    it("fecha abaixo do threshold após o hangover", () => {
        const decision = decideGateOpen({ ...base, level: 0.01 });
        expect(decision.open).toBe(false);
    });

    it("segura aberto dentro do hangover mesmo abaixo do threshold", () => {
        const decision = decideGateOpen({ ...base, level: 0.01, hangoverUntil: 10_200 });
        expect(decision.open).toBe(true);
        expect(decision.hangoverUntil).toBe(10_200);
    });

    it("modo off sempre abre", () => {
        const decision = decideGateOpen({ ...base, mode: "off", level: 0 });
        expect(decision.open).toBe(true);
    });

    it("threshold alto fecha a mesma voz que threshold baixo abre", () => {
        const level = 0.05;
        expect(decideGateOpen({ ...base, level, threshold: 0.01 }).open).toBe(true);
        expect(decideGateOpen({ ...base, level, threshold: 0.2 }).open).toBe(false);
    });
});
