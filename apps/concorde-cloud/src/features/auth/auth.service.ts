import { Credentials, isValidEmail, isValidUsernameFormat, LoginResponse, LoginTokensResponse, LoginTotpRequiredResponse, RegisterData, sanitizeUsername, User } from "@concorde/shared";
import {
	bumpPasswordResetAttempts,
	createAuthSession,
	createPasswordReset,
	createUser,
	deletePasswordResetsForUser,
	getAuthSessionById,
	getAuthSessionOwnership,
	getUserByEmail,
	getUserById,
	getUserRecordById,
	listPasswordResets,
	listUserSessions,
	purgeExpiredAuthSessions,
	purgeExpiredPasswordResets,
	revokeAuthSession,
	revokeAuthSessionsForUser,
	rotateAuthSession,
	setUserTotp
} from "./auth.repository";
import { CreateUserData, UserRecord } from "./auth.type";

import { AppError } from "../../utils/AppError";
import type { Env } from "../../types/Env";
import { sendEmail } from "../../utils/email";
import { hashPassword, verifyPassword } from "../../utils/auth.password";
import { createToken } from "../../utils/JWT";
import { buildTotpUrl, generateTotpSecret, verifyTotpCode } from "../../utils/totp";

import { updateDisplayName, updateProfileAppearance, updateUserPassword } from "./auth.repository";

const MAX_DISPLAY_NAME_LENGTH = 32;
const MAX_PASSWORD_LENGTH = 128;
/** dataURL de avatar: ~150KB de imagem em base64. */
const MAX_AVATAR_LENGTH = 200_000;
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const AVATAR_PATTERN = /^data:image\/(png|jpeg|webp);base64,/;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 15 * 60 * 1000;
const MAX_RESET_ATTEMPTS = 5;

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

async function issueSession(db: D1Database, secret: string, userId: string, userAgent?: string): Promise<SessionTokens> {
	const secret2 = randomSecret();
	const sessionId = await createAuthSession(db, userId, await sha256Hex(secret2), Date.now() + REFRESH_TTL_MS, userAgent);

	return {
		token: await createToken(userId, secret),
		refreshToken: `${sessionId}.${secret2}`
	};
}


export async function registerUser(db: D1Database, secret: string, data: RegisterData, userAgent?: string): Promise<LoginTokensResponse> {

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
	const tokens = await issueSession(db, secret, user.id, userAgent);

	return { user, ...tokens };
}

export async function loginUser(db: D1Database, secret: string, data: Credentials, userAgent?: string): Promise<LoginResponse> {
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

	// 2FA ativa (segredo confirmado) exige o código TOTP antes de emitir tokens.
	if (user.totpSecret && !user.totpPending) {
		if (!data.totp) {
			return { totpRequired: true } satisfies LoginTotpRequiredResponse;
		}

		const codeValid = await verifyTotpCode(user.totpSecret, data.totp);

		if (!codeValid) {
			throw AppError.badRequest("Código de verificação inválido.");
		}
	}

	// Housekeeping barato: sessões vencidas saem da tabela no login.
	void purgeExpiredAuthSessions(db).catch(() => { });

	const tokens = await issueSession(db, secret, user.id, userAgent);

	return {
		user: {
			id: user.id,
			username: user.username,
			displayName: user.displayName,
			email: user.email,
			friendsOnly: Boolean(user.friendsOnly),
			createdAt: user.createdAt,
			avatar: user.avatar ?? null,
			bannerFrom: user.bannerFrom ?? null,
			bannerTo: user.bannerTo ?? null
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
		createdAt: user.createdAt,
		avatar: user.avatar ?? null,
		bannerFrom: user.bannerFrom ?? null,
		bannerTo: user.bannerTo ?? null
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

export async function changeProfile(
	db: D1Database,
	id: string,
	body: { displayName?: unknown; avatar?: unknown; bannerFrom?: unknown; bannerTo?: unknown }
): Promise<User> {
	const fields: {
		displayName?: string;
		avatar?: string | null;
		bannerFrom?: string | null;
		bannerTo?: string | null;
	} = {};

	// Nome de exibição é opcional num PATCH customizado.
	if (body.displayName !== undefined) {
		if (typeof body.displayName !== "string") {
			throw AppError.badRequest("Informe um nome de exibição.");
		}

		const name = body.displayName.trim().slice(0, MAX_DISPLAY_NAME_LENGTH);

		if (name.length === 0) {
			throw AppError.badRequest("O nome de exibição não pode ficar vazio.");
		}

		if (name !== body.displayName.trim()) {
			throw AppError.badRequest(`O nome pode ter no máximo ${MAX_DISPLAY_NAME_LENGTH} caracteres.`);
		}

		fields.displayName = name;
	}

	// Foto: null remove (volta às iniciais); string exige dataURL de imagem comprimida.
	if (body.avatar !== undefined) {
		if (body.avatar === null) {
			fields.avatar = null;
		} else if (
			typeof body.avatar === "string" &&
			AVATAR_PATTERN.test(body.avatar.slice(0, 32)) &&
			body.avatar.length <= MAX_AVATAR_LENGTH
		) {
			fields.avatar = body.avatar;
		} else {
			throw AppError.badRequest("Foto inválida (use PNG, JPEG ou WebP até 150KB).");
		}
	}

	// Fundo do perfil: cada cor é #rrggbb ou null (lado com null fica sólido/tema).
	if (body.bannerFrom !== undefined || body.bannerTo !== undefined) {
		for (const [name, value] of [["bannerFrom", body.bannerFrom], ["bannerTo", body.bannerTo]] as const) {
			if (value === undefined) continue;

			if (value === null) {
				fields[name] = null;
			} else if (typeof value === "string" && COLOR_PATTERN.test(value)) {
				fields[name] = value.toLowerCase();
			} else {
				throw AppError.badRequest("Cor inválida (use #rrggbb).");
			}
		}
	}

	if (fields.displayName !== undefined) {
		await updateDisplayName(db, id, fields.displayName);
	}

	if (fields.avatar !== undefined || fields.bannerFrom !== undefined || fields.bannerTo !== undefined) {
		await updateProfileAppearance(db, id, {
			avatar: fields.avatar,
			bannerFrom: fields.bannerFrom,
			bannerTo: fields.bannerTo
		});
	}

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

export interface TotpStatus { enabled: boolean; pending: boolean }

export async function getTotpStatus(db: D1Database, id: string): Promise<TotpStatus> {
	const user = await getUserRecordById(db, id);

	if (!user) {
		throw AppError.notFound("Usuário não encontrado");
	}

	return {
		enabled: Boolean(user.totpSecret) && !user.totpPending,
		pending: Boolean(user.totpSecret) && user.totpPending === 1
	};
}

export async function enrollTotp(db: D1Database, id: string): Promise<{ secret: string; otpauthUrl: string }> {
	const user = await getUserRecordById(db, id);

	if (!user) {
		throw AppError.notFound("Usuário não encontrado");
	}

	if (user.totpSecret && !user.totpPending) {
		throw AppError.conflict("A 2FA já está ativa nesta conta.");
	}

	const secret = generateTotpSecret();
	await setUserTotp(db, id, secret, true);

	return { secret, otpauthUrl: buildTotpUrl(secret, user.username) };
}

export async function confirmTotpEnrollment(db: D1Database, id: string, code: unknown): Promise<void> {
	if (typeof code !== "string") {
		throw AppError.badRequest("Informe o código de verificação.");
	}

	const user = await getUserRecordById(db, id);

	if (!user || !user.totpSecret) {
		throw AppError.conflict("Nenhuma ativação de 2FA em andamento.");
	}

	if (!user.totpPending) {
		throw AppError.conflict("A 2FA já está ativa nesta conta.");
	}

	const codeValid = await verifyTotpCode(user.totpSecret, code);

	if (!codeValid) {
		throw AppError.badRequest("Código de verificação inválido.");
	}

	await setUserTotp(db, id, user.totpSecret, false);
}

export async function disableTotp(db: D1Database, id: string, code: unknown): Promise<void> {
	if (typeof code !== "string") {
		throw AppError.badRequest("Informe o código de verificação.");
	}

	const user = await getUserRecordById(db, id);

	if (!user || !user.totpSecret) {
		throw AppError.conflict("A 2FA não está ativa nesta conta.");
	}

	const codeValid = await verifyTotpCode(user.totpSecret, code);

	if (!codeValid) {
		throw AppError.badRequest("Código de verificação inválido.");
	}

	await setUserTotp(db, id, null, false);
}

export interface UserSessionInfo {
	id: string;
	createdAt: number;
	expiresAt: number;
	lastUsedAt: number;
	userAgent: string | null;
}

export async function listUserSessionsForApi(db: D1Database, id: string): Promise<UserSessionInfo[]> {
	const sessions = await listUserSessions(db, id);

	return sessions.map((session) => ({
		id: session.id,
		createdAt: session.createdAt,
		expiresAt: session.expiresAt,
		lastUsedAt: session.lastUsedAt,
		userAgent: session.userAgent ?? null
	}));
}

export async function revokeUserSessionById(db: D1Database, id: string, sessionId: string): Promise<void> {
	const session = await getAuthSessionOwnership(db, sessionId);

	if (!session) {
		throw AppError.notFound("Sessão não encontrada.");
	}

	if (session.userId !== id) {
		throw AppError.forbidden("Sessão pertence a outro usuário.");
	}

	await revokeAuthSession(db, sessionId);
}

/**
 * Gera um código de 6 dígitos, valida por 15 minutos e envia por email.
 * A resposta não revela se o email existe ou não (evita enumeração).
 */
export async function requestPasswordReset(db: D1Database, env: Env, email: unknown): Promise<{ sent: true; debugCode?: string }> {
	if (typeof email !== "string" || !isValidEmail(email.trim())) {
		throw AppError.badRequest("Informe um email válido.");
	}

	// Piggyback barato: códigos vencidos saem da tabela aqui.
	void purgeExpiredPasswordResets(db).catch(() => { });

	const user = await getUserByEmail(db, email.trim());

	if (user) {
		const bytes = new Uint32Array(1);
		crypto.getRandomValues(bytes);
		const code = String(bytes[0] % 1_000_000).padStart(6, "0");

		await createPasswordReset(db, user.id, await sha256Hex(code), Date.now() + RESET_TTL_MS);

		const sent = await sendEmail(
			env,
			user.email,
			"Recuperação de senha — Concorde",
			`
				<p>Olá,</p>
				<p>Seu código para redefinir a senha é <b>${code}</b>.</p>
				<p>Ele expira em 15 minutos e pode ser usado uma única vez.</p>
				<p>Se não foi você quem pediu, ignore este email.</p>
			`
		);

		if (!sent) {
			console.log(`[reset] código para ${user.email}: ${code}`);
		}

		if (env.PASSWORD_RESET_DEBUG === "1") {
			return { sent: true, debugCode: code };
		}
	}

	return { sent: true };
}

/** Valida o código recebido e troca a senha (uso único — código é apagado). */
export async function resetPasswordWithCode(db: D1Database, email: unknown, code: unknown, newPassword: unknown): Promise<void> {
	if (typeof code !== "string") {
		throw AppError.badRequest("Informe o código recebido por email.");
	}

	if (typeof newPassword !== "string" || newPassword.length < 6) {
		throw AppError.badRequest("A nova senha precisa de pelo menos 6 caracteres.");
	}

	if (newPassword.length > MAX_PASSWORD_LENGTH) {
		throw AppError.badRequest(`A senha pode ter no máximo ${MAX_PASSWORD_LENGTH} caracteres.`);
	}

	if (typeof email !== "string") {
		throw AppError.badRequest("Informe o email da conta.");
	}

	const user = await getUserByEmail(db, email.trim());

	if (!user) {
		throw AppError.badRequest("Código inválido ou expirado.");
	}

	const rows = await listPasswordResets(db, user.id);

	if (rows.length === 0) {
		throw AppError.badRequest("Código inválido ou expirado.");
	}

	const codeHash = await sha256Hex(code.trim());
	const match = rows.find((row) => timingSafeEqual(row.codeHash, codeHash));

	if (!match) {
		// Tenta de novo até MAX_RESET_ATTEMPTS; estourou, invalida tudo.
		const attempts = await bumpPasswordResetAttempts(db, rows[0].id);
		if (attempts !== null && attempts >= MAX_RESET_ATTEMPTS) {
			await deletePasswordResetsForUser(db, user.id);
		}

		throw AppError.badRequest("Código inválido ou expirado.");
	}

	await deletePasswordResetsForUser(db, user.id);

	const { hash, salt } = await hashPassword(newPassword);

	await updateUserPassword(db, user.id, hash, salt);

	// Redefinição de senha encerra todas as sessões do usuário.
	await revokeAuthSessionsForUser(db, user.id);
}