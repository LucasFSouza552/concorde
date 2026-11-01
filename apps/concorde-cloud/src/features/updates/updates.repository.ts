import { Env } from "../../types/Env";

export interface ClientVersion {
	id: string;
	username: string;
	displayName: string;
	appVersion: string | null;
	appVersionAt: number | null;
}

export async function getAppMeta(db: D1Database, key: string): Promise<string | null> {
	const row = await db
		.prepare("SELECT value FROM app_meta WHERE key = ?")
		.bind(key)
		.first<{ value: string }>();

	return row?.value ?? null;
}

export async function setAppMeta(db: D1Database, key: string, value: string): Promise<void> {
	await db
		.prepare(`
			INSERT INTO app_meta (key, value, updatedAt)
			VALUES (?1, ?2, ?3)
			ON CONFLICT(key) DO UPDATE SET value = ?2, updatedAt = ?3
		`)
		.bind(key, value, Date.now())
		.run();
}

export async function clearAppMeta(db: D1Database, key: string): Promise<void> {
	await db
		.prepare("DELETE FROM app_meta WHERE key = ?")
		.bind(key)
		.run();
}

export async function setUserAppVersion(db: D1Database, userId: string, version: string): Promise<void> {
	await db
		.prepare("UPDATE users SET appVersion = ?1, appVersionAt = ?2 WHERE id = ?3")
		.bind(version, Date.now(), userId)
		.run();
}

export async function listClientVersions(db: D1Database): Promise<ClientVersion[]> {
	const { results } = await db
		.prepare(`
			SELECT id, username, displayName, appVersion, appVersionAt
			FROM users
			ORDER BY appVersionAt DESC, username ASC
		`)
		.all<ClientVersion>();

	return results ?? [];
}
