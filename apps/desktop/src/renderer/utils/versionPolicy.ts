import { api } from "../api/api";

export interface VersionPolicy {
	minimum: string | null;
	latest: string | null;
}

/** Compara "X.Y.Z" — positivo quando `a` é mais antigo que `b`. */
export function isOutdatedVersion(current: string | null | undefined, minimum: string | null): boolean {
	if (!current || !minimum) return false;

	const currentParts = current.split(".").map((part) => Number.parseInt(part, 10));
	const minParts = minimum.split(".").map((part) => Number.parseInt(part, 10));

	if (currentParts.some(Number.isNaN) || minParts.some(Number.isNaN)) return false;

	for (let i = 0; i < 3; i += 1) {
		const cur = currentParts[i] ?? 0;
		const min = minParts[i] ?? 0;

		if (cur !== min) return cur < min;
	}

	return false;
}

/** Política pública — pode falhar (offline): devolve null e o app segue aberto. */
export async function fetchVersionPolicy(): Promise<VersionPolicy | null> {
	try {
		const { data } = await api.get<{ policy: VersionPolicy }>("/updates/policy");
		return data.policy;
	} catch {
		return null;
	}
}

/** Registra a versão do app deste cliente (silencioso). */
export async function reportAppVersion(version: string): Promise<void> {
	try {
		await api.post("/updates/report", { version });
	} catch {
		/* telemetria best-effort */
	}
}
