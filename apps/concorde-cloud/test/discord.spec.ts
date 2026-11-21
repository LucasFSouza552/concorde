import { SELF } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";

const RUN = Date.now();
const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
	vi.restoreAllMocks();
});

function unique(label: string): string {
	return `${label}${RUN}`;
}

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json" }
	});
}

function mockDiscord(identity: {
	id: string;
	username: string;
	email: string | null;
	verified?: boolean;
	displayName?: string;
}) {
	globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
		const url = typeof input === "string" ? input : input.toString();

		if (url.endsWith("/oauth2/token")) {
			return json({
				access_token: "discord-access-token",
				token_type: "Bearer",
				scope: "identify email"
			});
		}

		if (url.endsWith("/users/@me")) {
			return json({
				id: identity.id,
				username: identity.username,
				global_name: identity.displayName ?? `${identity.username} Name`,
				email: identity.email,
				verified: identity.verified ?? true,
				avatar: null
			});
		}

		if (url.endsWith("/oauth2/token/revoke")) {
			return json({});
		}

		return originalFetch(input, init);
	}) as typeof fetch;
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

async function me(token: string) {
	const response = await SELF.fetch("https://example.com/auth/me", { headers: bearer(token) });
	expect(response.status).toBe(200);
	return response.json<{ displayName: string; discordAutoSync?: boolean }>();
}

async function syncEvents(token: string) {
	const response = await SELF.fetch("https://example.com/auth/me/discord/events", {
		headers: bearer(token)
	});
	expect(response.status).toBe(200);
	const data = await response.json<{ events: { kind: string }[] }>();
	return data.events.filter((event) => event.kind === "sync").length;
}

interface SessionTokens {
	token: string;
	refreshToken: string;
	user: { id: string; username: string; hasPassword?: boolean };
	warning?: string;
}

interface DiscordStart {
	url: string;
	state: string;
	expiresAt: number;
}

async function registerUser(label: string): Promise<SessionTokens> {
	const response = await SELF.fetch("https://example.com/auth/register", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			email: `${unique(label)}@concorde.test`,
			password: `senha-${RUN}-${label}`,
			username: unique(label).toLowerCase()
		})
	});

	expect(response.status).toBe(201);
	return await response.json() as SessionTokens;
}

async function startOAuth(kind: "login" | "link", token?: string): Promise<Response> {
	return SELF.fetch(`https://example.com/auth/discord/${kind}/start`, {
		method: "POST",
		headers: token ? bearer(token) : undefined
	});
}

async function callback(code: string, state: string, token?: string): Promise<Response> {
	return SELF.fetch("https://example.com/auth/discord/callback", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			...(token ? bearer(token) : {})
		},
		body: JSON.stringify({ code, state, iss: "https://discord.com" })
	});
}

describe("Discord OAuth", () => {
	it("gera URL de autorização com PKCE e exige login para vincular", async () => {
		const response = await startOAuth("login");
		expect(response.status).toBe(200);

		const data = await response.json<DiscordStart>();
		const url = new URL(data.url);

		expect(url.origin + url.pathname).toBe("https://discord.com/oauth2/authorize");
		expect(url.searchParams.get("response_type")).toBe("code");
		expect(url.searchParams.get("scope")).toBe("identify email");
		expect(url.searchParams.get("redirect_uri")).toBe("concorde://oauth/discord");
		expect(url.searchParams.get("code_challenge_method")).toBe("S256");
		expect(url.searchParams.get("code_challenge")).toBeTruthy();
		expect(data.state).toMatch(/^[A-Za-z0-9_-]{32,128}$/);
		expect(data.expiresAt).toBeGreaterThan(Date.now());

		const forbidden = await startOAuth("link");
		expect(forbidden.status).toBe(401);
	});

	it("cria conta com confirmação, define senha e desvincula", async () => {
		const discordId = String(200000000000000000 + RUN % 100000000);
		mockDiscord({ id: discordId, username: `discord${RUN}`, email: `${unique("discord")}@concorde.test` });

		const started = await startOAuth("login");
		const { state } = await started.json<DiscordStart>();

		const callbackResponse = await callback("authorization-code", state);
		expect(callbackResponse.status).toBe(200);

		const pending = await callbackResponse.json<{
			registrationRequired: true;
			ticket: string;
			suggestion: { username: string; email: string };
		}>();
		expect(pending.registrationRequired).toBe(true);
		expect(pending.ticket).toMatch(/^[a-f0-9]{48}$/);
		expect(pending.suggestion.username).toBe(`discord${RUN}`);

		const replay = await callback("authorization-code", state);
		expect(replay.status).toBe(400);

		const registeredResponse = await SELF.fetch("https://example.com/auth/discord/register", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				ticket: pending.ticket,
				username: `escolhido${RUN}`,
				displayName: "Usuário Discord"
			})
		});
		expect(registeredResponse.status).toBe(201);

		const session = await registeredResponse.json<SessionTokens>();
		expect(session.user.username).toBe(`escolhido${RUN}`);
		expect(session.user.hasPassword).toBe(false);

		const integration = await SELF.fetch("https://example.com/auth/me/discord", {
			headers: bearer(session.token)
		});
		expect(integration.status).toBe(200);
		const status = await integration.json<{ connected: boolean; account: { providerAccountId: string } | null }>();
		expect(status.connected).toBe(true);
		expect(status.account?.providerAccountId).toBe(discordId);

		const blockedUnlink = await SELF.fetch("https://example.com/auth/me/discord", {
			method: "DELETE",
			headers: bearer(session.token)
		});
		expect(blockedUnlink.status).toBe(409);

		const setup = await SELF.fetch("https://example.com/auth/me/password/setup", {
			method: "POST",
			headers: { "Content-Type": "application/json", ...bearer(session.token) },
			body: JSON.stringify({ password: `nova-senha-${RUN}` })
		});
		expect(setup.status).toBe(200);

		const unlink = await SELF.fetch("https://example.com/auth/me/discord", {
			method: "DELETE",
			headers: bearer(session.token)
		});
		expect(unlink.status).toBe(200);

		const after = await SELF.fetch("https://example.com/auth/me/discord", {
			headers: bearer(session.token)
		});
		expect((await after.json<{ connected: boolean }>()).connected).toBe(false);
	});

	it("vincula e desvincula Discord em conta com senha", async () => {
		const user = await registerUser("linkdiscord");
		const discordId = String(300000000000000000 + RUN % 100000000);
		mockDiscord({ id: discordId, username: `link${RUN}`, email: `${unique("linkdisc")}@concorde.test` });

		const started = await startOAuth("link", user.token);
		expect(started.status).toBe(200);
		const { state } = await started.json<DiscordStart>();

		const linkedResponse = await callback("authorization-code", state, user.token);
		expect(linkedResponse.status).toBe(200);
		const linked = await linkedResponse.json<{ status: "linked" }>();
		expect(linked.status).toBe("linked");

		const integration = await SELF.fetch("https://example.com/auth/me/discord", {
			headers: bearer(user.token)
		});
		const status = await integration.json<{ connected: boolean; autoSync: boolean }>();
		expect(status.connected).toBe(true);
		expect(status.autoSync).toBe(true);
		expect((await me(user.token)).displayName).toBe(`link${RUN} Name`);

		const unlink = await SELF.fetch("https://example.com/auth/me/discord", {
			method: "DELETE",
			headers: bearer(user.token)
		});
		expect(unlink.status).toBe(200);
	});

	it("bloqueia primeiro login quando o e-mail já possui conta", async () => {
		const existing = await registerUser("conflictemail");
		const discordId = String(400000000000000000 + RUN % 100000000);
		mockDiscord({
			id: discordId,
			username: `conflict${RUN}`,
			email: `${unique("conflictemail")}@concorde.test`
		});

		const { state } = await (await startOAuth("login")).json<DiscordStart>();
		const response = await callback("authorization-code", state);
		expect(response.status).toBe(409);
		expect(existing.token).toBeTruthy();
	});

	it("sincroniza perfil, registra histórico e controla exibição do vínculo", async () => {
		const user = await registerUser("syncdiscord");
		const discordId = String(500000000000000000 + RUN % 100000000);
		const identity = { id: discordId, username: `sync${RUN}`, email: `${unique("syncdiscord")}@concorde.test` };
		mockDiscord(identity);

		const linkStart = await startOAuth("link", user.token);
		const { state: linkState } = await linkStart.json<DiscordStart>();
		expect((await callback("authorization-code", linkState, user.token)).status).toBe(200);

		const integration = await SELF.fetch("https://example.com/auth/me/discord", {
			headers: bearer(user.token)
		});
		const initial = await integration.json<{ verified: boolean; showcase: boolean }>();
		expect(initial.verified).toBe(true);
		expect(initial.showcase).toBe(false);

		const showcase = await SELF.fetch("https://example.com/auth/me/discord/showcase", {
			method: "PATCH",
			headers: { "Content-Type": "application/json", ...bearer(user.token) },
			body: JSON.stringify({ enabled: true })
		});
		expect(showcase.status).toBe(200);
		expect((await showcase.json<{ showcase: boolean }>()).showcase).toBe(true);

		const syncStart = await SELF.fetch("https://example.com/auth/discord/sync/start", {
			method: "POST",
			headers: bearer(user.token)
		});
		expect(syncStart.status).toBe(200);
		const { state: syncState } = await syncStart.json<DiscordStart>();

		const syncedResponse = await callback("authorization-code", syncState, user.token);
		expect(syncedResponse.status).toBe(200);
		const synced = await syncedResponse.json<{
			status: "synced";
			user: { displayName: string; discordVerified: boolean };
			account: { verified: boolean };
		}>();
		expect(synced.status).toBe("synced");
		expect(synced.user.displayName).toBe(`${identity.username} Name`);
		expect(synced.user.discordVerified).toBe(true);
		expect(synced.account.verified).toBe(true);

		const history = await SELF.fetch("https://example.com/auth/me/discord/events", {
			headers: bearer(user.token)
		});
		const events = await history.json<{ events: { kind: string }[] }>();
		expect(events.events.map((event) => event.kind)).toContain("linked");
		expect(events.events.map((event) => event.kind)).toContain("sync");
	});

	it("aplica perfil salvo sem nova autorização e respeita a aplicação automática", async () => {
		const user = await registerUser("applydiscord");
		const discordId = String(700000000000000000 + RUN % 100000000);
		const originalName = `Aplicar ${RUN}`;
		const identity = {
			id: discordId,
			username: `apply${RUN}`,
			email: `${unique("applydiscord")}@concorde.test`,
			displayName: originalName
		};
		mockDiscord(identity);

		const linkStart = await startOAuth("link", user.token);
		const { state: linkState } = await linkStart.json<DiscordStart>();
		expect((await callback("authorization-code", linkState, user.token)).status).toBe(200);
		expect((await me(user.token)).displayName).toBe(originalName);

		const apply = await SELF.fetch("https://example.com/auth/me/discord/apply", {
			method: "POST",
			headers: bearer(user.token)
		});
		expect(apply.status).toBe(200);
		const applied = await apply.json<{ status: string; user: { displayName: string } }>();
		expect(applied.status).toBe("synced");
		expect(applied.user.displayName).toBe(originalName);

		const syncsAfterApply = await syncEvents(user.token);

		const autoOff = await SELF.fetch("https://example.com/auth/me/discord/auto-sync", {
			method: "PATCH",
			headers: { "Content-Type": "application/json", ...bearer(user.token) },
			body: JSON.stringify({ enabled: false })
		});
		expect(autoOff.status).toBe(200);
		expect((await autoOff.json<{ autoSync: boolean }>()).autoSync).toBe(false);

		const changedName = "Nome Alterado no Discord";
		mockDiscord({ ...identity, displayName: changedName });

		async function loginWithDiscord() {
			const { state } = await (await startOAuth("login")).json<DiscordStart>();
			const response = await callback("authorization-code", state);
			expect(response.status).toBe(200);
			return response.json<{ user: { displayName: string }; warning?: string }>();
		}

		const withoutAuto = await loginWithDiscord();
		expect(withoutAuto.user.displayName).toBe(originalName);
		expect(await syncEvents(user.token)).toBe(syncsAfterApply);

		const autoOn = await SELF.fetch("https://example.com/auth/me/discord/auto-sync", {
			method: "PATCH",
			headers: { "Content-Type": "application/json", ...bearer(user.token) },
			body: JSON.stringify({ enabled: true })
		});
		expect(autoOn.status).toBe(200);
		expect((await autoOn.json<{ autoSync: boolean }>()).autoSync).toBe(true);

		const withAuto = await loginWithDiscord();
		expect(withAuto.user.displayName).toBe(changedName);
		expect((await me(user.token)).displayName).toBe(changedName);
		expect(await syncEvents(user.token)).toBe(syncsAfterApply + 1);

		const syncsBeforeFailure = await syncEvents(user.token);
		mockDiscord({ ...identity, displayName: "   " });
		const failedApply = await loginWithDiscord();
		expect(failedApply.warning).toContain("Login concluído");
		expect((await me(user.token)).displayName).toBe(changedName);
		expect(await syncEvents(user.token)).toBe(syncsBeforeFailure);
	});

	it("confirma ações sensíveis com o Discord uma única vez", async () => {
		const label = "reauthuser";
		const user = await registerUser(label);
		const discordId = String(600000000000000000 + RUN % 100000000);
		mockDiscord({
			id: discordId,
			username: `reauth${RUN}`,
			email: `${unique("reauthuser")}@concorde.test`
		});

		const linkStart = await startOAuth("link", user.token);
		const { state: linkState } = await linkStart.json<DiscordStart>();
		expect((await callback("authorization-code", linkState, user.token)).status).toBe(200);

		async function confirm(action: "email" | "password") {
			const start = await SELF.fetch("https://example.com/auth/discord/reauth/start", {
				method: "POST",
				headers: { "Content-Type": "application/json", ...bearer(user.token) },
				body: JSON.stringify({ action })
			});
			expect(start.status).toBe(200);
			const { state } = await start.json<DiscordStart>();

			const response = await callback("authorization-code", state, user.token);
			expect(response.status).toBe(200);
			return response.json<{ confirmation: { id: string; action: string } }>();
		}

		const emailConfirmation = await confirm("email");
		expect(emailConfirmation.confirmation.action).toBe("email");

		const emailChange = await SELF.fetch("https://example.com/auth/me/email", {
			method: "PATCH",
			headers: { "Content-Type": "application/json", ...bearer(user.token) },
			body: JSON.stringify({
				email: `${unique("reauthnew")}@concorde.test`,
				confirmationId: emailConfirmation.confirmation.id
			})
		});
		expect(emailChange.status).toBe(200);

		const replayEmail = await SELF.fetch("https://example.com/auth/me/email", {
			method: "PATCH",
			headers: { "Content-Type": "application/json", ...bearer(user.token) },
			body: JSON.stringify({
				email: `${unique("reauthreplay")}@concorde.test`,
				confirmationId: emailConfirmation.confirmation.id
			})
		});
		expect(replayEmail.status).toBe(400);

		const passwordConfirmation = await confirm("password");
		const passwordChange = await SELF.fetch("https://example.com/auth/me/password", {
			method: "POST",
			headers: { "Content-Type": "application/json", ...bearer(user.token) },
			body: JSON.stringify({
				currentPassword: `senha-${RUN}-${label}`,
				newPassword: `nova-senha-${RUN}`,
				confirmationId: passwordConfirmation.confirmation.id
			})
		});
		expect(passwordChange.status).toBe(200);

		const withoutConfirmation = await SELF.fetch("https://example.com/auth/me/password", {
			method: "POST",
			headers: { "Content-Type": "application/json", ...bearer(user.token) },
			body: JSON.stringify({
				currentPassword: `nova-senha-${RUN}`,
				newPassword: `outra-senha-${RUN}`
			})
		});
		expect(withoutConfirmation.status).toBe(400);
	});
});
