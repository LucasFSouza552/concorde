import { Credentials, isValidEmail, isValidUsernameFormat, LoginResponse, RegisterData, sanitizeUsername, User } from "@concorde/shared";
import {
	createAuthSession,
	createUser,
	getAuthSessionById,
	getUserByEmail,
	getUserById,
	purgeExpiredAuthSessions,
	revokeAuthSession,
	revokeAuthSessionsForUser,
	rotateAuthSession
} from "./auth.repository";
import { CreateUserData, UserRecord } from "./auth.type";

import { AppError } from "../../utils/AppError";
import { hashPassword, verifyPassword } from "../../utils/auth.password";
import { createToken } from "../../utils/JWT";

import { getUserRecordById, updateDisplayName, updateUserPassword } from "./auth.repository";

const MAX_DISPLAY_NAME_LENGTH = 32;
const MAX_PASSWORD_LENGTH = 128;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

async function sha256Hex(value: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));

	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;

	let diff = 0;

	for (let i = 0; i < a.length; i++) {
		diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}

	return diff === 0;
}

function randomSecret(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);

	return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function parseRefreshToken(raw: string): { sessionId: string; secret: string } | null {
	const separator = raw.indexOf(".");

	if (separator < 1 || separator === raw.length - 1) return null;

	return {
		sessionId: raw.slice(0, separator),
		secret: raw.slice(separator + 1)
	};
}

export interface SessionTokens {
	token: string;
	refreshToken: string;
}

async function issueSession(db: D1Database, secret: string, userId: string): Promise<SessionTokens> {
	const secret2 = randomSecret();
	const sessionId = await createAuthSession(db, userId, await sha256Hex(secret2), Date.now() + REFRESH_TTL_MS);

	return {
		token: await createToken(userId, secret),
		refreshToken: `${sessionId}.${secret2}`
	};
}


export async function registerUser(db: D1Database, secret: string, data: RegisterData): Promise<LoginResponse> {

	const { email, password } = data;
	const username = sanitizeUsername(data.username);

	if (!isValidUsernameFormat(username)) {
		throw AppError.badRequest("Use letras minúsculas, números, ponto e underline.");
	}

	if (!isValidEmail(email)) {
		throw AppError.badRequest("O email é inválido");
	}

	const existingUser = await getUserByEmail(db, email);

	if (existingUser) {
		throw AppError.conflict("O email já possui uma conta.");
	}

	const { hash, salt } = await hashPassword(password);

	const userData: CreateUserData = {
		username: username,
		email: email,
		passwordHash: hash,
		passwordSalt: salt
	};

	const user = await createUser(db, userData);
	const tokens = await issueSession(db, secret, user.id);

	return { user, ...tokens };
}

export async function loginUser(db: D1Database, secret: string, data: Credentials): Promise<LoginResponse> {
	const user = await getUserByEmail(db, data.email);

	if (!user) {
		throw AppError.conflict("Email ou senha inválidos");
	}

	const passwordValid = await verifyPassword(
		data.password,
		user.passwordHash,
		user.passwordSalt
	);

	if (!passwordValid) {
		throw AppError.conflict("Email ou senha inválidos");
	}

	// Housekeeping barato: sessões vencidas saem da tabela no login.
	void purgeExpiredAuthSessions(db).catch(() => { });

	const tokens = await issueSession(db, secret, user.id);

	return {
		user: {
			id: user.id,
			username: user.username,
			displayName: user.displayName,
			email: user.email,
			friendsOnly: Boolean(user.friendsOnly),
			createdAt: user.createdAt
		},
		...tokens
	};
}

async function toApiUser(user: UserRecord): Promise<User> {
	return {
		id: user.id,
		username: user.username,
		displayName: user.displayName,
		email: user.email,
		friendsOnly: Boolean(user.friendsOnly),
		createdAt: user.createdAt
	};
}

export async function refreshSession(db: D1Database, secret: string, refreshToken: unknown): Promise<LoginResponse> {
	if (typeof refreshToken !== "string") {
		throw AppError.unauthorized("Refresh token inválido.");
	}

	const parsed = parseRefreshToken(refreshToken);

	if (!parsed) {
		throw AppError.unauthorized("Refresh token inválido.");
	}

	const session = await getAuthSessionById(db, parsed.sessionId);

	if (!session) {
		throw AppError.unauthorized("Sessão expirada.");
	}

	const now = Date.now();

	if (session.expiresAt < now) {
		await revokeAuthSession(db, session.id);
		throw AppError.unauthorized("Sessão expirada.");
	}

	const secretValid = timingSafeEqual(await sha256Hex(parsed.secret), session.refreshHash);

	if (!secretValid) {
		// Token já rotacionado (possível reuso/roubo): mata a sessão inteira.
		await revokeAuthSession(db, session.id);
		throw AppError.unauthorized("Sessão inválida.");
	}

	const user = await getUserRecordById(db, session.userId);

	if (!user) {
		await revokeAuthSession(db, session.id);
		throw AppError.unauthorized("Sessão inválida.");
	}

	const nextSecret = randomSecret();

	await rotateAuthSession(db, session.id, await sha256Hex(nextSecret), now + REFRESH_TTL_MS);

	return {
		user: await toApiUser(user),
		token: await createToken(user.id, secret),
		refreshToken: `${session.id}.${nextSecret}`
	};
}

export async function logoutSession(db: D1Database, userId: string | null, refreshToken: unknown): Promise<void> {
	if (typeof refreshToken === "string") {
		const parsed = parseRefreshToken(refreshToken);

		if (parsed) {
			await revokeAuthSession(db, parsed.sessionId);
			return;
		}
	}

	if (userId) {
		// Sem refresh token no corpo: logout encerra todas as sessões do usuário.
		await revokeAuthSessionsForUser(db, userId);
	}
}

export async function getCurrentUser(db: D1Database, id: string): Promise<User> {
	const user = await getUserById(db, id);

	if (!user) {
		throw AppError.notFound("Usuário não encontrado");
	}

	return user;
}

export async function changeDisplayName(db: D1Database, id: string, displayName: unknown): Promise<User> {
	if (typeof displayName !== "string") {
		throw AppError.badRequest("Informe um nome de exibição.");
	}

	const name = displayName.trim().slice(0, MAX_DISPLAY_NAME_LENGTH);

	if (name.length === 0) {
		throw AppError.badRequest("O nome de exibição não pode ficar vazio.");
	}

	if (name !== displayName.trim()) {
		throw AppError.badRequest(`O nome pode ter no máximo ${MAX_DISPLAY_NAME_LENGTH} caracteres.`);
	}

	await updateDisplayName(db, id, name);

	const user = await getUserById(db, id);

	if (!user) {
		throw AppError.notFound("Usuário não encontrado");
	}

	return user;
}

export async function changePassword(db: D1Database, id: string, currentPassword: unknown, newPassword: unknown): Promise<void> {
	if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
		throw AppError.badRequest("Informe a senha atual e a nova senha.");
	}

	if (!currentPassword || !newPassword) {
		throw AppError.badRequest("Informe a senha atual e a nova senha.");
	}

	if (newPassword.length < 6) {
		throw AppError.badRequest("A nova senha precisa de pelo menos 6 caracteres.");
	}

	if (newPassword.length > MAX_PASSWORD_LENGTH) {
		throw AppError.badRequest(`A senha pode ter no máximo ${MAX_PASSWORD_LENGTH} caracteres.`);
	}

	const record = await getUserRecordById(db, id);

	if (!record) {
		throw AppError.notFound("Usuário não encontrado");
	}

	const currentValid = await verifyPassword(currentPassword, record.passwordHash, record.passwordSalt);

	if (!currentValid) {
		throw AppError.badRequest("A senha atual está incorreta.");
	}

	const { hash, salt } = await hashPassword(newPassword);

	await updateUserPassword(db, id, hash, salt);

	// Troca de senha invalida todas as sessões do usuário.
	await revokeAuthSessionsForUser(db, id);
}