import { User } from "@concorde/shared";

export interface UserRecord extends User {
	passwordHash: string;
	passwordSalt: string;
	/** Segredo TOTP (base32) — null quando 2FA nunca foi ativada. */
	totpSecret?: string | null;
	/** 1 quando a 2FA está aguardando confirmação (primeiro código). */
	totpPending?: number;
}

export interface CreateUserData {
	username: string;
	email: string;
	passwordHash: string;
	passwordSalt: string;
	displayName?: string;
}

export interface DiscordAccountRecord {
	id: string;
	userId: string;
	provider: string;
	providerAccountId: string;
	providerUsername: string | null;
	providerDisplayName?: string | null;
	providerAvatar: string | null;
	verified?: number | boolean;
	createdAt: number;
	updatedAt: number;
}