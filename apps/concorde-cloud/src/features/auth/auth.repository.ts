import { RegisterData, User } from "@concorde/shared";
import { CreateUserData, UserRecord } from "./auth.type";

export async function createUser(db: D1Database, data: CreateUserData) {
	const id = crypto.randomUUID();
	const createdAt = Date.now();

	await db
		.prepare(`
			INSERT INTO users (
				id,
				username,
				displayName,
				friendsOnly,
				email,
				passwordHash,
				passwordSalt,
				createdAt
			)
			VALUES (?, ?, ?, ?, ?, ?, ?,?)
		`)
		.bind(
			id,
			data.username,
			data.username,
			1,
			data.email,
			data.passwordHash,
			data.passwordSalt,
			createdAt
		)
		.run();

	return {
		id,
		username: data.username,
		displayName: data.username,
		email: data.email,
		friendsOnly: true,
		createdAt
	};
}

export async function getUserByEmail(db: D1Database, email: string): Promise<UserRecord | null> {
	const user = await db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first<UserRecord>();
	if (user) user.friendsOnly = Boolean(user.friendsOnly as unknown as number);
	return user;
}

export async function getUserById(db: D1Database, id: string): Promise<User | null> {
	const user = await db
		.prepare(`SELECT id, username, displayName, email, friendsOnly, createdAt, avatar, bannerFrom, bannerTo FROM users WHERE id = ?`)
		.bind(id)
		.first<User>();

	return user;
}

export async function getUserRecordById(db: D1Database, id: string): Promise<UserRecord | null> {
	const user = await db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<UserRecord>();

	if (user) user.friendsOnly = Boolean(user.friendsOnly as unknown as number);

	return user;
}

export async function updateDisplayName(db: D1Database, id: string, displayName: string) {
	await db
		.prepare("UPDATE users SET displayName = ? WHERE id = ?")
		.bind(displayName, id)
		.run();
}

/** Campos de customização do perfil (foto e fundo); undefined = não mexer. */
export async function updateProfileAppearance(
	db: D1Database,
	id: string,
	fields: { avatar?: string | null; bannerFrom?: string | null; bannerTo?: string | null }
) {
	const sets: string[] = [];
	const binds: (string | null)[] = [];

	if (fields.avatar !== undefined) {
		sets.push("avatar = ?");
		binds.push(fields.avatar);
	}

	if (fields.bannerFrom !== undefined) {
		sets.push("bannerFrom = ?");
		binds.push(fields.bannerFrom);
	}

	if (fields.bannerTo !== undefined) {
		sets.push("bannerTo = ?");
		binds.push(fields.bannerTo);
	}

	if (sets.length === 0) return;

	// Bind posicional (D1 não aceita named params).
	await db
		.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`)
		.bind(...binds, id)
		.run();
}

export async function updateUserPassword(db: D1Database, id: string, passwordHash: string, passwordSalt: string) {
	await db
		.prepare("UPDATE users SET passwordHash = ?, passwordSalt = ? WHERE id = ?")
		.bind(passwordHash, passwordSalt, id)
		.run();
}

export interface AuthSessionRecord {
	id: string;
	userId: string;
	refreshHash: string;
	createdAt: number;
	expiresAt: number;
	lastUsedAt: number;
	userAgent?: string | null;
}

export async function createAuthSession(db: D1Database, userId: string, refreshHash: string, expiresAt: number, userAgent?: string) {
	const id = crypto.randomUUID();
	const createdAt = Date.now();

	await db
		.prepare(`
			INSERT INTO auth_sessions (id, userId, refreshHash, createdAt, expiresAt, lastUsedAt, userAgent)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`)
		.bind(id, userId, refreshHash, createdAt, expiresAt, createdAt, userAgent ?? null)
		.run();

	return id;
}

export async function getAuthSessionById(db: D1Database, id: string): Promise<AuthSessionRecord | null> {
	return await db
		.prepare("SELECT * FROM auth_sessions WHERE id = ?")
		.bind(id)
		.first<AuthSessionRecord>();
}

export async function rotateAuthSession(db: D1Database, id: string, refreshHash: string, expiresAt: number) {
	await db
		.prepare("UPDATE auth_sessions SET refreshHash = ?, expiresAt = ?, lastUsedAt = ? WHERE id = ?")
		.bind(refreshHash, expiresAt, Date.now(), id)
		.run();
}

export async function revokeAuthSession(db: D1Database, id: string) {
	await db.prepare("DELETE FROM auth_sessions WHERE id = ?").bind(id).run();
}

export async function revokeAuthSessionsForUser(db: D1Database, userId: string) {
	await db.prepare("DELETE FROM auth_sessions WHERE userId = ?").bind(userId).run();
}

export async function purgeExpiredAuthSessions(db: D1Database) {
	await db.prepare("DELETE FROM auth_sessions WHERE expiresAt < ?").bind(Date.now()).run();
}

export async function listUserSessions(db: D1Database, userId: string): Promise<AuthSessionRecord[]> {
	const { results } = await db
		.prepare(`
			SELECT id, createdAt, expiresAt, lastUsedAt, userAgent
			FROM auth_sessions
			WHERE userId = ? AND expiresAt > ?
			ORDER BY createdAt DESC
		`)
		.bind(userId, Date.now())
		.all<AuthSessionRecord>();

	return results ?? [];
}

export async function getAuthSessionOwnership(db: D1Database, id: string): Promise<AuthSessionRecord | null> {
	return await db
		.prepare("SELECT id, userId, expiresAt FROM auth_sessions WHERE id = ?")
		.bind(id)
		.first<AuthSessionRecord>();
}

export async function setUserTotp(db: D1Database, userId: string, secret: string | null, pending: boolean) {
	await db
		.prepare("UPDATE users SET totpSecret = ?, totpPending = ? WHERE id = ?")
		.bind(secret, pending ? 1 : 0, userId)
		.run();
}

export interface PasswordResetRecord {
	id: string;
	userId: string;
	codeHash: string;
	attempts: number;
	createdAt: number;
	expiresAt: number;
}

export async function createPasswordReset(db: D1Database, userId: string, codeHash: string, expiresAt: number) {
	const id = crypto.randomUUID();
	const createdAt = Date.now();

	await db
		.prepare(`
			INSERT INTO password_resets (id, userId, codeHash, attempts, createdAt, expiresAt)
			VALUES (?, ?, ?, 0, ?, ?)
		`)
		.bind(id, userId, codeHash, createdAt, expiresAt)
		.run();

	return id;
}

export async function listPasswordResets(db: D1Database, userId: string): Promise<PasswordResetRecord[]> {
	const { results } = await db
		.prepare(`
			SELECT *
			FROM password_resets
			WHERE userId = ? AND expiresAt > ?
			ORDER BY createdAt DESC
		`)
		.bind(userId, Date.now())
		.all<PasswordResetRecord>();

	return results ?? [];
}

export async function bumpPasswordResetAttempts(db: D1Database, id: string): Promise<number | null> {
	const row = await db
		.prepare("UPDATE password_resets SET attempts = attempts + 1 WHERE id = ? RETURNING attempts")
		.bind(id)
		.first<{ attempts: number }>();

	return row?.attempts ?? null;
}

export async function deletePasswordResetsForUser(db: D1Database, userId: string) {
	await db.prepare("DELETE FROM password_resets WHERE userId = ?").bind(userId).run();
}

export async function purgeExpiredPasswordResets(db: D1Database) {
	await db.prepare("DELETE FROM password_resets WHERE expiresAt < ?").bind(Date.now()).run();
}
