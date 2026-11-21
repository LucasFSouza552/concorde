import {
	isValidEmail,
	isValidUsernameFormat,
	sanitizeUsername,
	type DiscordCallbackResult,
	type DiscordEvent,
	type DiscordIntegrationStatus,
	type DiscordLinkedResult,
	type DiscordOauthPurpose,
	type DiscordOauthStart,
	type DiscordReauthResult,
	type DiscordRegistrationRequired,
	type DiscordSensitiveAction,
	type DiscordSyncedResult,
	type LoginTokensResponse
} from "@concorde/shared";

import { AppError } from "../../utils/AppError";
import type { Env } from "../../types/Env";
import { hashPassword } from "../../utils/auth.password";
import { generateOauthState, generatePkceVerifier, pkceChallenge } from "../../utils/pkce";

import {
	createExternalUser,
	getUserByEmail,
	getUserById,
	getUserByUsername,
	getUserRecordById,
	revokeAuthSessionsForUser,
	setDiscordAutoSync,
	setDiscordShowcase,
	setDiscordVerified,
	updateUserPassword
} from "./auth.repository";
import { changeProfile, issueSession, toApiUser } from "./auth.service";
import {
	consumeDiscordRegistration,
	createOAuthConfirmation,
	consumeOAuthTransaction,
	createAuthAccount,
	createDiscordRegistration,
	createOAuthTransaction,
	deleteAuthAccount,
	getAuthAccountByProviderAccount,
	getAuthAccountByUserAndProvider,
	listDiscordEvents,
	purgeExpiredOAuthTransactions,
	recordDiscordEvent,
	toDiscordAccountInfo,
	touchAuthAccount,
	type DiscordRegistrationRecord
} from "./discord.repository";
import type { DiscordAccountRecord } from "./auth.type";

const PROVIDER = "discord";
const OAUTH_TTL_MS = 10 * 60 * 1000;
const DEFAULT_API_BASE = "https://discord.com/api";
const AUTHORIZE_URL = "https://discord.com/oauth2/authorize";
const ISSUER = "https://discord.com";
const MAX_AVATAR_BYTES = 150_000;
const MAX_PASSWORD_LENGTH = 128;

interface DiscordConfig {
	clientId: string;
	clientSecret: string;
	redirectUri: string;
	apiBase: string;
}

interface DiscordIdentity {
	id: string;
	username: string;
	displayName: string;
	email: string | null;
	emailVerified: boolean;
	avatar: string | null;
}

function requireConfig(env: Env): DiscordConfig {
	const { DISCORD_CLIENT_ID: clientId, DISCORD_CLIENT_SECRET: clientSecret, DISCORD_REDIRECT_URI: redirectUri } = env;

	if (!clientId || !clientSecret || !redirectUri) {
		throw AppError.internal("Integração Discord não configurada.");
	}

	let parsed: URL;
	try {
		parsed = new URL(redirectUri);
	} catch {
		throw AppError.internal("Redirect URI do Discord inválida.");
	}

	if (parsed.protocol !== "concorde:" || !parsed.hostname) {
		throw AppError.internal("Redirect URI do Discord inválida.");
	}

	return {
		clientId,
		clientSecret,
		redirectUri,
		apiBase: (env.DISCORD_API_BASE_URL ?? DEFAULT_API_BASE).replace(/\/$/, "")
	};
}

async function sha256Hex(value: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));

	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomHex(bytes: number): string {
	const data = new Uint8Array(bytes);
	crypto.getRandomValues(data);

	return [...data].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function basicAuth(config: DiscordConfig): string {
	return `Basic ${btoa(`${config.clientId}:${config.clientSecret}`)}`;
}

function base64FromBytes(bytes: Uint8Array): string {
	let binary = "";

	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	return btoa(binary);
}

function validateCallbackInput(code: unknown, state: unknown, iss: unknown): { code: string; state: string } {
	if (typeof code !== "string" || code.length < 1 || code.length > 256 || /[\s\x00-\x1f]/.test(code)) {
		throw AppError.badRequest("Código de autorização inválido.");
	}

	if (typeof state !== "string" || !/^[A-Za-z0-9_-]{32,128}$/.test(state)) {
		throw AppError.badRequest("Estado OAuth inválido.");
	}

	if (iss !== undefined && iss !== null && iss !== ISSUER) {
		throw AppError.badRequest("Origem da autorização inválida.");
	}

	return { code, state };
}

async function revokeToken(config: DiscordConfig, accessToken: string): Promise<void> {
	try {
		await fetch(`${config.apiBase}/oauth2/token/revoke`, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				Authorization: basicAuth(config)
			},
			body: new URLSearchParams({ token: accessToken, token_type_hint: "access_token" })
		});
	} catch {
		// Revogação best-effort: nenhum token Discord fica armazenado.
	}
}

async function fetchDiscordAvatar(id: string, hash: unknown): Promise<string | null> {
	if (typeof hash !== "string" || !/^[a-f0-9]{32}$/.test(hash)) return null;

	try {
		const response = await fetch(`https://cdn.discordapp.com/avatars/${id}/${hash}.png?size=128`);
		if (!response.ok) return null;

		const type = response.headers.get("content-type") ?? "";
		if (!/^image\/(png|jpeg|webp)/.test(type)) return null;

		const bytes = new Uint8Array(await response.arrayBuffer());
		if (!bytes.length || bytes.length > MAX_AVATAR_BYTES) return null;

		const mime = type.startsWith("image/jpeg") ? "jpeg" : type.startsWith("image/webp") ? "webp" : "png";

		return `data:image/${mime};base64,${base64FromBytes(bytes)}`;
	} catch {
		return null;
	}
}

async function fetchDiscordIdentity(config: DiscordConfig, code: string, verifier: string): Promise<DiscordIdentity> {
	const response = await fetch(`${config.apiBase}/oauth2/token`, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			Authorization: basicAuth(config)
		},
		body: new URLSearchParams({
			grant_type: "authorization_code",
			code,
			redirect_uri: config.redirectUri,
			code_verifier: verifier
		})
	}).catch(() => null);

	if (!response?.ok) {
		throw AppError.badRequest("Não foi possível concluir a autorização com o Discord.");
	}

	const tokens = await response.json() as { access_token?: unknown; token_type?: unknown; scope?: unknown };

	if (typeof tokens.access_token !== "string" || !tokens.access_token || tokens.token_type !== "Bearer") {
		throw AppError.badRequest("Resposta de autorização do Discord inválida.");
	}

	if (typeof tokens.scope === "string" && !tokens.scope.split(" ").includes("identify")) {
		throw AppError.badRequest("Permissão de identidade do Discord não autorizada.");
	}

	const accessToken = tokens.access_token;

	try {
		const userResponse = await fetch(`${config.apiBase}/users/@me`, {
			headers: { Authorization: `Bearer ${accessToken}` }
		}).catch(() => null);

		if (!userResponse?.ok) {
			throw AppError.badRequest("Não foi possível consultar a identidade no Discord.");
		}

		const user = await userResponse.json() as {
			id?: unknown;
			username?: unknown;
			global_name?: unknown;
			email?: unknown;
			verified?: unknown;
			avatar?: unknown;
		};

		if (typeof user.id !== "string" || !/^\d{5,25}$/.test(user.id) || typeof user.username !== "string" || !user.username) {
			throw AppError.badRequest("Identidade do Discord inválida.");
		}

		return {
			id: user.id,
			username: user.username,
			displayName: typeof user.global_name === "string" && user.global_name
				? user.global_name.slice(0, 32)
				: user.username.slice(0, 32),
			email: typeof user.email === "string" && isValidEmail(user.email) ? user.email : null,
			emailVerified: user.verified === true,
			avatar: await fetchDiscordAvatar(user.id, user.avatar)
		};
	} finally {
		await revokeToken(config, accessToken);
	}
}

function uniqueUsernameSuggestion(base: string): string {
	const cleaned = sanitizeUsername(base);

	return isValidUsernameFormat(cleaned) ? cleaned : `user${randomHex(4)}`;
}

async function suggestUsername(db: D1Database, identity: DiscordIdentity): Promise<string> {
	const base = uniqueUsernameSuggestion(identity.username);

	if (!await getUserByUsername(db, base)) return base;

	for (let attempt = 0; attempt < 8; attempt++) {
		const candidate = `${base}_${randomHex(2)}`;
		if (!await getUserByUsername(db, candidate)) return candidate;
	}

	throw AppError.conflict("Não foi possível sugerir um nome de usuário único.");
}

export async function startDiscordOAuth(
	db: D1Database,
	env: Env,
	purpose: DiscordOauthPurpose,
	userId: string | null,
	action?: DiscordSensitiveAction | null
): Promise<DiscordOauthStart> {
	const config = requireConfig(env);

	if (purpose === "link" || purpose === "sync" || purpose === "reauth") {
		if (!userId) {
			throw AppError.unauthorized("É necessário entrar para usar esta ação com o Discord.");
		}
	}

	if (purpose === "reauth" && action !== "email" && action !== "password") {
		throw AppError.badRequest("Ação sensível inválida.");
	}

	const state = generateOauthState();
	const verifier = generatePkceVerifier();
	const expiresAt = Date.now() + OAUTH_TTL_MS;

	await createOAuthTransaction(db, {
		stateHash: await sha256Hex(state),
		codeVerifier: verifier,
		purpose,
		action,
		userId,
		expiresAt
	});

	void purgeExpiredOAuthTransactions(db).catch(() => { });

	const url = new URL(AUTHORIZE_URL);
	url.searchParams.set("response_type", "code");
	url.searchParams.set("client_id", config.clientId);
	url.searchParams.set("scope", "identify email");
	url.searchParams.set("redirect_uri", config.redirectUri);
	url.searchParams.set("state", state);
	url.searchParams.set("prompt", "consent");
	url.searchParams.set("code_challenge", await pkceChallenge(verifier));
	url.searchParams.set("code_challenge_method", "S256");

	return { url: url.toString(), state, expiresAt };
}

async function applyProfileFromAccount(db: D1Database, userId: string, account: DiscordAccountRecord) {
	const displayName = account.providerDisplayName ?? account.providerUsername;
	if (!displayName) throw AppError.badRequest("Não foi possível aplicar o nome do Discord.");

	return changeProfile(db, userId, {
		displayName,
		avatar: account.providerAvatar
	});
}

async function linkIdentity(db: D1Database, userId: string, identity: DiscordIdentity): Promise<DiscordLinkedResult> {
	const existingUser = await getUserRecordById(db, userId);
	if (!existingUser) throw AppError.notFound("Usuário não encontrado.");

	const used = await getAuthAccountByProviderAccount(db, PROVIDER, identity.id);
	if (used) {
		throw AppError.conflict(used.userId === userId
			? "Esta conta Discord já está vinculada ao seu perfil."
			: "Esta conta Discord já pertence a outra conta Concorde.");
	}

	const own = await getAuthAccountByUserAndProvider(db, userId, PROVIDER);
	if (own) {
		throw AppError.conflict("Este perfil já possui uma conta Discord vinculada.");
	}

	const created = await createAuthAccount(db, {
		userId,
		provider: PROVIDER,
		providerAccountId: identity.id,
		providerUsername: identity.username,
		providerDisplayName: identity.displayName,
		providerAvatar: identity.avatar,
		verified: identity.emailVerified
	});

	await applyProfileFromAccount(db, userId, created);
	await setDiscordAutoSync(db, userId, true);
	await setDiscordVerified(db, userId, identity.emailVerified);
	await recordDiscordEvent(db, userId, "linked");

	return { status: "linked", account: toDiscordAccountInfo(created) };
}

async function loginOrRegister(
	db: D1Database,
	env: Env,
	identity: DiscordIdentity,
	userAgent?: string
): Promise<LoginTokensResponse | DiscordRegistrationRequired> {
	const linked = await getAuthAccountByProviderAccount(db, PROVIDER, identity.id);

	if (linked) {
		const user = await getUserRecordById(db, linked.userId);
		if (!user) throw AppError.conflict("A conta vinculada não existe mais.");

		const accountChanged =
			linked.providerUsername !== identity.username ||
			(linked.providerDisplayName ?? linked.providerUsername) !== identity.displayName ||
			linked.providerAvatar !== identity.avatar ||
			Boolean(linked.verified) !== identity.emailVerified;
		const shouldApply = Boolean(user.discordAutoSync);
		const profileChanged = shouldApply && (
			user.displayName !== identity.displayName ||
			(user.avatar ?? null) !== identity.avatar
		);
		let warning: string | undefined;

		if (accountChanged || shouldApply) {
			try {
				if (accountChanged) {
					await touchAuthAccount(db, linked.id, {
						providerUsername: identity.username,
						providerDisplayName: identity.displayName,
						providerAvatar: identity.avatar,
						verified: identity.emailVerified
					});
				}

				if (shouldApply) {
					await applyProfileFromAccount(db, user.id, {
						...linked,
						providerUsername: identity.username,
						providerDisplayName: identity.displayName,
						providerAvatar: identity.avatar
					});
					if (profileChanged) await recordDiscordEvent(db, user.id, "sync");
				}
			} catch {
				warning = "Login concluído, mas não foi possível atualizar os dados do Discord neste acesso.";
			}
		}

		await setDiscordVerified(db, user.id, identity.emailVerified);
		await recordDiscordEvent(db, user.id, "login");

		const fresh = await getUserRecordById(db, user.id) ?? user;
		const tokens = await issueSession(db, env.JWT_SECRET, user.id, userAgent);

		return { user: await toApiUser(fresh), ...tokens, ...(warning ? { warning } : {}) };
	}

	if (!identity.email || !identity.emailVerified) {
		throw AppError.conflict("Autorize o e-mail no Discord ou entre com sua conta existente e vincule o Discord nas configurações.");
	}

	if (await getUserByEmail(db, identity.email)) {
		throw AppError.conflict("Este e-mail já possui uma conta. Entre com sua conta e vincule o Discord nas configurações.");
	}

	const suggestion = await suggestUsername(db, identity);
	const ticket = randomHex(24);

	const registration: DiscordRegistrationRecord = {
		id: ticket,
		providerAccountId: identity.id,
		username: suggestion,
		displayName: identity.displayName,
		email: identity.email,
		avatar: identity.avatar,
		expiresAt: Date.now() + OAUTH_TTL_MS
	};

	await createDiscordRegistration(db, registration);

	return {
		registrationRequired: true,
		ticket,
		suggestion: {
			username: suggestion,
			displayName: identity.displayName,
			email: identity.email,
			avatar: identity.avatar
		}
	};
}

async function syncDiscordProfile(
	db: D1Database,
	userId: string,
	identity: DiscordIdentity
): Promise<DiscordSyncedResult> {
	const account = await getAuthAccountByUserAndProvider(db, userId, PROVIDER);
	if (!account) throw AppError.notFound("Nenhuma conta Discord vinculada.");

	await setDiscordAutoSync(db, userId, true);

	const user = await changeProfile(db, userId, {
		displayName: identity.displayName,
		avatar: identity.avatar
	});

	await touchAuthAccount(db, account.id, {
		providerUsername: identity.username,
		providerDisplayName: identity.displayName,
		providerAvatar: identity.avatar,
		verified: identity.emailVerified
	});
	await setDiscordVerified(db, userId, identity.emailVerified);
	await recordDiscordEvent(db, userId, "sync");

	const updated = await getAuthAccountByUserAndProvider(db, userId, PROVIDER) ?? account;

	return {
		status: "synced",
		user: { ...user, discordVerified: identity.emailVerified },
		account: toDiscordAccountInfo(updated)
	};
}

export async function handleDiscordCallback(
	db: D1Database,
	env: Env,
	input: { code: unknown; state: unknown; iss?: unknown },
	authenticatedUserId: string | null,
	userAgent?: string
): Promise<DiscordCallbackResult> {
	const config = requireConfig(env);
	const { code, state } = validateCallbackInput(input.code, input.state, input.iss);
	const transaction = await consumeOAuthTransaction(db, await sha256Hex(state), Date.now());

	if (!transaction) {
		throw AppError.badRequest("Sessão OAuth inválida, expirada ou já utilizada.");
	}

	if (transaction.purpose === "link" || transaction.purpose === "sync" || transaction.purpose === "reauth") {
		if (!authenticatedUserId) {
			throw AppError.unauthorized("Sua sessão expirou. Entre novamente para continuar com o Discord.");
		}

		if (transaction.userId !== authenticatedUserId) {
			throw AppError.forbidden("Esta autorização pertence a outra conta.");
		}
	} else if (authenticatedUserId && transaction.userId && transaction.userId !== authenticatedUserId) {
		throw AppError.forbidden("Esta autorização pertence a outra conta.");
	}

	const identity = await fetchDiscordIdentity(config, code, transaction.codeVerifier);

	if (transaction.purpose === "link") {
		return linkIdentity(db, transaction.userId as string, identity);
	}

	if (transaction.purpose === "sync") {
		return syncDiscordProfile(db, transaction.userId as string, identity);
	}

	if (transaction.purpose === "reauth") {
		if (!transaction.action) {
			throw AppError.badRequest("Ação sensível inválida.");
		}

		const confirmation = await createOAuthConfirmation(db, transaction.userId as string, transaction.action, OAUTH_TTL_MS);

		return { confirmation } satisfies DiscordReauthResult;
	}

	return loginOrRegister(db, env, identity, userAgent);
}

export async function completeDiscordRegistration(
	db: D1Database,
	env: Env,
	input: { ticket?: unknown; username?: unknown; displayName?: unknown },
	userAgent?: string
): Promise<LoginTokensResponse> {
	if (typeof input.ticket !== "string" || !/^[a-f0-9]{48}$/.test(input.ticket)) {
		throw AppError.badRequest("Ticket de criação inválido.");
	}

	const registration = await consumeDiscordRegistration(db, input.ticket, Date.now());
	if (!registration) {
		throw AppError.badRequest("Ticket de criação inválido ou expirado.");
	}

	const username = sanitizeUsername(typeof input.username === "string" ? input.username : registration.username);
	if (!isValidUsernameFormat(username)) {
		throw AppError.badRequest("Use letras minúsculas, números, ponto e underline.");
	}

	const displayName = typeof input.displayName === "string" && input.displayName.trim()
		? input.displayName.trim().slice(0, 32)
		: username;

	if (await getUserByUsername(db, username)) {
		throw AppError.conflict("Este nome de usuário já está em uso.");
	}

	if (await getUserByEmail(db, registration.email)) {
		throw AppError.conflict("Este e-mail já possui uma conta. Entre com sua conta e vincule o Discord nas configurações.");
	}

	const user = await createExternalUser(db, {
		username,
		displayName,
		email: registration.email,
		passwordHash: randomHex(32),
		passwordSalt: randomHex(16)
	});

	await createAuthAccount(db, {
		userId: user.id,
		provider: PROVIDER,
		providerAccountId: registration.providerAccountId,
		providerUsername: username,
		providerDisplayName: registration.displayName,
		providerAvatar: registration.avatar,
		verified: true
	});

	await setDiscordAutoSync(db, user.id, true);
	await setDiscordVerified(db, user.id, true);
	await recordDiscordEvent(db, user.id, "linked");

	const fresh = await getUserRecordById(db, user.id);
	if (!fresh) throw AppError.notFound("Usuário não encontrado.");

	const tokens = await issueSession(db, env.JWT_SECRET, user.id, userAgent);

	return {
		user: { ...await toApiUser(fresh), avatar: registration.avatar, hasPassword: false },
		...tokens
	};
}

export async function getDiscordIntegration(db: D1Database, userId: string): Promise<DiscordIntegrationStatus> {
	const account = await getAuthAccountByUserAndProvider(db, userId, PROVIDER);
	const user = await getUserById(db, userId);

	return {
		connected: Boolean(account),
		account: account ? toDiscordAccountInfo(account) : null,
		showcase: Boolean(user?.discordShowcase),
		verified: Boolean(user?.discordVerified),
		autoSync: Boolean(user?.discordAutoSync)
	};
}

export async function startDiscordSync(db: D1Database, env: Env, userId: string): Promise<DiscordOauthStart> {
	if (!await getAuthAccountByUserAndProvider(db, userId, PROVIDER)) {
		throw AppError.notFound("Nenhuma conta Discord vinculada.");
	}

	return startDiscordOAuth(db, env, "sync", userId);
}

export async function startDiscordReauth(
	db: D1Database,
	env: Env,
	userId: string,
	action: DiscordSensitiveAction
): Promise<DiscordOauthStart> {
	if (!await getAuthAccountByUserAndProvider(db, userId, PROVIDER)) {
		throw AppError.notFound("Nenhuma conta Discord vinculada.");
	}

	return startDiscordOAuth(db, env, "reauth", userId, action);
}

export async function getDiscordEventHistory(db: D1Database, userId: string): Promise<DiscordEvent[]> {
	return listDiscordEvents(db, userId);
}

export async function setDiscordProfileShowcase(
	db: D1Database,
	userId: string,
	enabled: unknown
): Promise<DiscordIntegrationStatus> {
	const account = await getAuthAccountByUserAndProvider(db, userId, PROVIDER);
	if (!account) throw AppError.notFound("Nenhuma conta Discord vinculada.");

	if (typeof enabled !== "boolean") {
		throw AppError.badRequest("Informe se deseja exibir o vínculo no perfil.");
	}

	await setDiscordShowcase(db, userId, enabled);

	return getDiscordIntegration(db, userId);
}

export async function applyDiscordProfile(db: D1Database, userId: string): Promise<DiscordSyncedResult> {
	const account = await getAuthAccountByUserAndProvider(db, userId, PROVIDER);
	if (!account) throw AppError.notFound("Nenhuma conta Discord vinculada.");

	const user = await applyProfileFromAccount(db, userId, account);
	await recordDiscordEvent(db, userId, "sync");

	return {
		status: "synced",
		user,
		account: toDiscordAccountInfo(account)
	};
}

export async function setDiscordAutoSyncEnabled(
	db: D1Database,
	userId: string,
	enabled: unknown
): Promise<DiscordIntegrationStatus> {
	const account = await getAuthAccountByUserAndProvider(db, userId, PROVIDER);
	if (!account) throw AppError.notFound("Nenhuma conta Discord vinculada.");

	if (typeof enabled !== "boolean") {
		throw AppError.badRequest("Informe se deseja aplicar o perfil automaticamente.");
	}

	await setDiscordAutoSync(db, userId, enabled);

	return getDiscordIntegration(db, userId);
}

export async function unlinkDiscord(db: D1Database, userId: string): Promise<{ status: "unlinked" }> {
	const account = await getAuthAccountByUserAndProvider(db, userId, PROVIDER);
	if (!account) throw AppError.notFound("Nenhuma conta Discord vinculada.");

	const user = await getUserRecordById(db, userId);
	if (!user) throw AppError.notFound("Usuário não encontrado.");

	if (user.hasPassword === false) {
		throw AppError.conflict("Defina uma senha antes de desvincular o Discord.");
	}

	await deleteAuthAccount(db, userId, PROVIDER);
	await setDiscordAutoSync(db, userId, false);
	await setDiscordVerified(db, userId, false);
	await setDiscordShowcase(db, userId, false);
	await recordDiscordEvent(db, userId, "unlinked");
	await revokeAuthSessionsForUser(db, userId);

	return { status: "unlinked" };
}

export async function setInitialPassword(db: D1Database, userId: string, password: unknown): Promise<{ status: "updated" }> {
	if (typeof password !== "string" || password.length < 6 || password.length > MAX_PASSWORD_LENGTH) {
		throw AppError.badRequest("A senha precisa ter entre 6 e 128 caracteres.");
	}

	const user = await getUserRecordById(db, userId);
	if (!user) throw AppError.notFound("Usuário não encontrado.");
	if (user.hasPassword !== false) throw AppError.conflict("Esta conta já possui uma senha.");

	const { hash, salt } = await hashPassword(password);
	await updateUserPassword(db, userId, hash, salt);

	return { status: "updated" };
}
