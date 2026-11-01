import { clearAppMeta, getAppMeta, listClientVersions, setAppMeta, setUserAppVersion, type ClientVersion } from "./updates.repository";

import { AppError } from "../../utils/AppError";

const MIN_VERSION_KEY = "minVersion";
const LATEST_VERSION_KEY = "latestVersion";

const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

export interface VersionPolicy {
	/** Versão mínima exigida — clientes abaixo desta ficam bloqueados. */
	minimum: string | null;
	/** Versão mais recente conhecida (informativo para os clientes). */
	latest: string | null;
}

function requireAdminToken(adminToken: string | undefined): void {
	if (!adminToken) {
		throw AppError.forbidden("ADMIN_TOKEN não configurado no servidor.");
	}
}

export async function getVersionPolicy(db: D1Database): Promise<VersionPolicy> {
	const [minimum, latest] = await Promise.all([
		getAppMeta(db, MIN_VERSION_KEY),
		getAppMeta(db, LATEST_VERSION_KEY)
	]);

	return { minimum, latest };
}

export async function setVersionPolicy(
	db: D1Database,
	adminToken: string | undefined,
	input: { minVersion?: string | null; latestVersion?: string | null }
): Promise<VersionPolicy> {
	requireAdminToken(adminToken);

	const minVersion = input.minVersion ?? null;
	const latestVersion = input.latestVersion ?? null;

	for (const [key, value] of [["minVersion", minVersion], ["latestVersion", latestVersion]] as const) {
		if (value !== null && !VERSION_PATTERN.test(value)) {
			throw AppError.badRequest(`${key} é inválido — use o formato X.Y.Z (ex.: "0.1.10").`);
		}
	}

	if (minVersion !== null) {
		await setAppMeta(db, MIN_VERSION_KEY, minVersion);
	} else {
		await clearAppMeta(db, MIN_VERSION_KEY);
	}

	if (latestVersion !== null) {
		await setAppMeta(db, LATEST_VERSION_KEY, latestVersion);
	} else {
		await clearAppMeta(db, LATEST_VERSION_KEY);
	}

	return getVersionPolicy(db);
}

export async function reportClientVersion(db: D1Database, userId: string, version: string): Promise<void> {
	if (!VERSION_PATTERN.test(version)) {
		// Versão esquisita (build de dev): registra mesmo assim, sem travar o app.
		version = version.slice(0, 32);
	}

	await setUserAppVersion(db, userId, version);
}

export async function listClients(db: D1Database, adminToken: string | undefined): Promise<ClientVersion[]> {
	requireAdminToken(adminToken);
	return listClientVersions(db);
}
