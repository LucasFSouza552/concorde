import type {
	DiscordAccountInfo,
	DiscordEvent,
	DiscordEventKind,
	DiscordOauthPurpose,
	DiscordSensitiveAction
} from "@concorde/shared";

import type { DiscordAccountRecord } from "./auth.type";

export interface OAuthTransactionRecord {
	id: string;
	stateHash: string;
	codeVerifier: string;
	purpose: DiscordOauthPurpose;
	action: DiscordSensitiveAction | null;
	userId: string | null;
	expiresAt: number;
}

export interface DiscordRegistrationRecord {
	id: string;
	providerAccountId: string;
	username: string;
	displayName: string;
	email: string;
	avatar: string | null;
	expiresAt: number;
}

export async function createOAuthTransaction(
	db: D1Database,
	data: {
		stateHash: string;
		codeVerifier: string;
		purpose: DiscordOauthPurpose;
		action?: DiscordSensitiveAction | null;
		userId: string | null;
		expiresAt: number;
	}
): Promise<void> {
	await db
		.prepare(`
			INSERT INTO oauth_transactions (id, stateHash, codeVerifier, purpose, action, userId, createdAt, expiresAt)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`)
		.bind(
			crypto.randomUUID(),
			data.stateHash,
			data.codeVerifier,
			data.purpose,
			data.action ?? null,
			data.userId,
			Date.now(),
			data.expiresAt
		)
		.run();
}

/** Consumo atômico: duas requisições com o mesmo state nunca retornam a transação. */
export async function consumeOAuthTransaction(db: D1Database, stateHash: string, now: number): Promise<OAuthTransactionRecord | null> {
	return db
		.prepare(`
			UPDATE oauth_transactions
			SET consumedAt = ?
			WHERE stateHash = ? AND consumedAt IS NULL AND expiresAt > ?
			RETURNING id, stateHash, codeVerifier, purpose, action, userId, expiresAt
		`)
		.bind(now, stateHash, now)
		.first<OAuthTransactionRecord>();
}

export async function purgeExpiredOAuthTransactions(db: D1Database): Promise<void> {
	await db.prepare("DELETE FROM oauth_transactions WHERE expiresAt < ?").bind(Date.now()).run();
}

export async function getAuthAccountByProviderAccount(
	db: D1Database,
	provider: string,
	providerAccountId: string
): Promise<DiscordAccountRecord | null> {
	return db
		.prepare("SELECT * FROM auth_accounts WHERE provider = ? AND providerAccountId = ?")
		.bind(provider, providerAccountId)
		.first<DiscordAccountRecord>();
}

export async function getAuthAccountByUserAndProvider(
	db: D1Database,
	userId: string,
	provider: string
): Promise<DiscordAccountRecord | null> {
	return db
		.prepare("SELECT * FROM auth_accounts WHERE userId = ? AND provider = ?")
		.bind(userId, provider)
		.first<DiscordAccountRecord>();
}

export async function createAuthAccount(
	db: D1Database,
	data: {
		userId: string;
		provider: string;
		providerAccountId: string;
		providerUsername: string | null;
		providerDisplayName?: string | null;
		providerAvatar: string | null;
		verified?: boolean;
	}
): Promise<DiscordAccountRecord> {
	const now = Date.now();
	const verified = data.verified === true;
	const record: DiscordAccountRecord = {
		id: crypto.randomUUID(),
		userId: data.userId,
		provider: data.provider,
		providerAccountId: data.providerAccountId,
		providerUsername: data.providerUsername,
		providerDisplayName: data.providerDisplayName ?? data.providerUsername,
		providerAvatar: data.providerAvatar,
		verified,
		createdAt: now,
		updatedAt: now
	};

	await db
		.prepare(`
			INSERT INTO auth_accounts (id, userId, provider, providerAccountId, providerUsername, providerDisplayName, providerAvatar, verified, createdAt, updatedAt)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`)
		.bind(record.id, record.userId, record.provider, record.providerAccountId, record.providerUsername, record.providerDisplayName, record.providerAvatar, verified ? 1 : 0, now, now)
		.run();

	return record;
}

export async function touchAuthAccount(
	db: D1Database,
	id: string,
	data: {
		providerUsername: string | null;
		providerDisplayName?: string | null;
		providerAvatar: string | null;
		verified?: boolean;
	}
): Promise<void> {
	const displayName = data.providerDisplayName ?? data.providerUsername;

	if (data.verified === undefined) {
		await db
			.prepare("UPDATE auth_accounts SET providerUsername = ?, providerDisplayName = ?, providerAvatar = ?, updatedAt = ? WHERE id = ?")
			.bind(data.providerUsername, displayName, data.providerAvatar, Date.now(), id)
			.run();
		return;
	}

	await db
		.prepare("UPDATE auth_accounts SET providerUsername = ?, providerDisplayName = ?, providerAvatar = ?, verified = ?, updatedAt = ? WHERE id = ?")
		.bind(data.providerUsername, displayName, data.providerAvatar, data.verified ? 1 : 0, Date.now(), id)
		.run();
}

export async function deleteAuthAccount(db: D1Database, userId: string, provider: string): Promise<boolean> {
	const result = await db
		.prepare("DELETE FROM auth_accounts WHERE userId = ? AND provider = ?")
		.bind(userId, provider)
		.run();

	return (result.meta?.changes ?? 0) > 0;
}

export async function createDiscordRegistration(
	db: D1Database,
	data: DiscordRegistrationRecord
): Promise<void> {
	await db
		.prepare(`
			INSERT INTO oauth_registrations (id, provider, providerAccountId, email, username, displayName, avatar, createdAt, expiresAt)
			VALUES (?, 'discord', ?, ?, ?, ?, ?, ?, ?)
		`)
		.bind(data.id, data.providerAccountId, data.email, data.username, data.displayName, data.avatar, Date.now(), data.expiresAt)
		.run();
}

export async function consumeDiscordRegistration(db: D1Database, id: string, now: number): Promise<DiscordRegistrationRecord | null> {
	return db
		.prepare(`
			UPDATE oauth_registrations
			SET consumedAt = ?
			WHERE id = ? AND consumedAt IS NULL AND expiresAt > ?
			RETURNING id, providerAccountId, email, username, displayName, avatar, expiresAt
		`)
		.bind(now, id, now)
		.first<DiscordRegistrationRecord>();
}

export function toDiscordAccountInfo(record: DiscordAccountRecord): DiscordAccountInfo {
	return {
		provider: "discord",
		providerAccountId: record.providerAccountId,
		providerUsername: record.providerUsername,
		providerDisplayName: record.providerDisplayName ?? record.providerUsername,
		providerAvatar: record.providerAvatar,
		linkedAt: record.createdAt,
		verified: Boolean(record.verified)
	};
}

export async function recordDiscordEvent(
	db: D1Database,
	userId: string,
	kind: DiscordEventKind,
	metadata: string | null = null
): Promise<void> {
	await db
		.prepare("INSERT INTO discord_events (id, userId, kind, metadata, createdAt) VALUES (?, ?, ?, ?, ?)")
		.bind(crypto.randomUUID(), userId, kind, metadata, Date.now())
		.run();
}

export async function listDiscordEvents(db: D1Database, userId: string, limit = 30): Promise<DiscordEvent[]> {
	const rows = await db
		.prepare("SELECT id, kind, metadata, createdAt FROM discord_events WHERE userId = ? ORDER BY createdAt DESC LIMIT ?")
		.bind(userId, limit)
		.all<DiscordEvent>();

	return rows.results;
}

export async function createOAuthConfirmation(
	db: D1Database,
	userId: string,
	action: DiscordSensitiveAction,
	ttlMs: number
): Promise<{ id: string; action: DiscordSensitiveAction; expiresAt: number }> {
	const id = crypto.randomUUID();
	const createdAt = Date.now();
	const expiresAt = createdAt + ttlMs;

	await db
		.prepare("INSERT INTO oauth_confirmations (id, userId, action, createdAt, expiresAt) VALUES (?, ?, ?, ?, ?)")
		.bind(id, userId, action, createdAt, expiresAt)
		.run();

	return { id, action, expiresAt };
}

export async function consumeOAuthConfirmation(
	db: D1Database,
	id: string,
	userId: string,
	action: DiscordSensitiveAction,
	now: number
): Promise<boolean> {
	const row = await db
		.prepare(`
			UPDATE oauth_confirmations
			SET consumedAt = ?
			WHERE id = ? AND userId = ? AND action = ? AND consumedAt IS NULL AND expiresAt > ?
			RETURNING id
		`)
		.bind(now, id, userId, action, now)
		.first<{ id: string }>();

	return Boolean(row);
}
