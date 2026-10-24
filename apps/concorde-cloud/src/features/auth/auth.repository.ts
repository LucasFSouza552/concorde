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
	const user = await db.prepare(`SELECT id, username, displayName, email, friendsOnly, createdAt FROM users WHERE id = ?`).bind(id).first<User>();

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
}

export async function createAuthSession(db: D1Database, userId: string, refreshHash: string, expiresAt: number) {
	const id = crypto.randomUUID();
	const createdAt = Date.now();

	await db
		.prepare(`
			INSERT INTO auth_sessions (id, userId, refreshHash, createdAt, expiresAt, lastUsedAt)
			VALUES (?, ?, ?, ?, ?, ?)
		`)
		.bind(id, userId, refreshHash, createdAt, expiresAt, createdAt)
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
