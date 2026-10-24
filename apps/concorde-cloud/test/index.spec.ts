import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

const RUN = Date.now();

function uniqueEmail(label: string): string {
	return `${label}.${RUN}@concorde.test`;
}

function uniqueUsername(label: string): string {
	// sanitizeUsername aceita [a-z0-9_.]
	return `usr_${label}_${RUN}`.toLowerCase();
}

type RegisterResult = { user: { id: string; username: string }; token: string; refreshToken: string };

async function registerUser(label: string): Promise<RegisterResult> {
	const response = await SELF.fetch("https://example.com/auth/register", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			email: uniqueEmail(label),
			password: `senha-${RUN}-${label}`,
			username: uniqueUsername(label)
		})
	});

	expect(response.status).toBe(201);

	return (await response.json()) as RegisterResult;
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

describe("Concorde API", () => {
	it("responde 404 em rota inexistente", async () => {
		const response = await SELF.fetch("https://example.com/rota-que-nao-existe");
		expect(response.status).toBe(404);
	});

	it("exige token em rota protegida", async () => {
		const response = await SELF.fetch("https://example.com/friends");
		expect(response.status).toBe(401);

		const body = await response.json<{ message: string }>();
		expect(body.message).toBe("Token de acesso não foi enviado.");
	});

	it("rejeita formato de token inválido", async () => {
		const response = await SELF.fetch("https://example.com/friends", {
			headers: { Authorization: "Token abc123" },
		});
		expect(response.status).toBe(401);
	});

	it("cadastra, autentica e resolve /auth/me", async () => {
		const registered = await registerUser("me");
		expect(registered.user.username).toBe(uniqueUsername("me"));

		const unauthorized = await SELF.fetch("https://example.com/auth/me");
		expect(unauthorized.status).toBe(401);

		const ok = await SELF.fetch("https://example.com/auth/me", { headers: bearer(registered.token) });
		expect(ok.status).toBe(200);

		const me = await ok.json<{ username: string }>();
		expect(me.username).toBe(uniqueUsername("me"));
	});

	it("GET /auth/users não existe mais", async () => {
		const response = await SELF.fetch("https://example.com/auth/users");
		expect(response.status).not.toBe(200);
	});

	it("exige token no handshake da call (sem e com token inválido)", async () => {
		const withoutToken = await SELF.fetch("https://example.com/call/sala-de-teste");
		expect(withoutToken.status).toBe(401);

		const body = await withoutToken.json<{ message: string }>();
		expect(body.message).toBe("É necessário informar o token de acesso.");

		const withBadToken = await SELF.fetch("https://example.com/call/sala-de-teste?token=abc.def.ghi");
		expect(withBadToken.status).toBe(401);
		expect((await withBadToken.json<{ message: string }>()).message).toBe("Token inválido ou expirado.");
	});

	it("presence sem Bearer é 401, mesmo com x-verified-user forjado", async () => {
		const forged = await SELF.fetch("https://example.com/user/qualquer/presence", {
			headers: { "x-verified-user": "vidade-atacante" }
		});
		expect(forged.status).toBe(401);

		const wrongScheme = await SELF.fetch("https://example.com/user/qualquer/presence", {
			headers: { Authorization: "Basic xyz" }
		});
		expect(wrongScheme.status).toBe(401);

		const badToken = await SELF.fetch("https://example.com/user/qualquer/presence", {
			headers: { Authorization: "Bearer abc.def.ghi" }
		});
		expect(badToken.status).toBe(401);
	});

	it("presence autenticada: estranho recebe forma offline genérica", async () => {
		const [viewer, stranger] = await Promise.all([
			registerUser("viewer"),
			registerUser("stranger")
		]);

		const response = await SELF.fetch(`https://example.com/user/${stranger.user.id}/presence`, {
			headers: bearer(viewer.token)
		});
		expect(response.status).toBe(200);

		const presence = await response.json<{ status: string; online: boolean; inCall: boolean; groupId: string | null; concordeGroupId: string | null }>();
		expect(presence).toEqual({
			status: "offline",
			online: false,
			inCall: false,
			groupId: null,
			concordeGroupId: null
		});
	});

	it("emite refresh token no login/registro e rotaciona a cada refresh", async () => {
		const registered = await registerUser("refresh");
		expect(registered.refreshToken).toMatch(/\.+/);

		const refresh1 = await SELF.fetch("https://example.com/auth/refresh", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ refreshToken: registered.refreshToken })
		});
		expect(refresh1.status).toBe(200);

		const session1 = await refresh1.json<RegisterResult>();
		expect(session1.user.id).toBe(registered.user.id);
		expect(session1.token).toBeTruthy();
		expect(session1.refreshToken).not.toBe(registered.refreshToken);

		// Reuso do refresh antigo (rotacionado) deve matar a sessão.
		const reuse = await SELF.fetch("https://example.com/auth/refresh", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ refreshToken: registered.refreshToken })
		});
		expect(reuse.status).toBe(401);

		const postReuse = await SELF.fetch("https://example.com/auth/refresh", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ refreshToken: session1.refreshToken })
		});
		expect(postReuse.status).toBe(401);
	});

	it("logout com refresh token revoga a sessão", async () => {
		const legged = await registerUser("logout");

		const logout = await SELF.fetch("https://example.com/auth/logout", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ refreshToken: legged.refreshToken })
		});
		expect(logout.status).toBe(200);

		const refresh = await SELF.fetch("https://example.com/auth/refresh", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ refreshToken: legged.refreshToken })
		});
		expect(refresh.status).toBe(401);
	});

	it("refresh com corpo inválido é 401", async () => {
		const bad = await SELF.fetch("https://example.com/auth/refresh", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ refreshToken: "nao-tem-ponto" })
		});
		expect(bad.status).toBe(401);
	});

	it("presence em lote: 401 sem token e corpo inválido é 400", async () => {
		const noAuth = await SELF.fetch("https://example.com/user/presence/batch", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ ids: ["x"] })
		});
		expect(noAuth.status).toBe(401);

		const [viewer] = await Promise.all([registerUser("batch-viewer")]);

		const invalid = await SELF.fetch("https://example.com/user/presence/batch", {
			method: "POST",
			headers: { "Content-Type": "application/json", ...bearer(viewer.token) },
			body: JSON.stringify({ ids: [] })
		});
		expect(invalid.status).toBe(400);

		const [other] = await Promise.all([registerUser("batch-other")]);

		const ok = await SELF.fetch("https://example.com/user/presence/batch", {
			method: "POST",
			headers: { "Content-Type": "application/json", ...bearer(viewer.token) },
			body: JSON.stringify({ ids: [other.user.id, other.user.id, `inexistente-${RUN}`] })
		});
		expect(ok.status).toBe(200);

		const { presences } = await ok.json<{ presences: Record<string, { online: boolean }> }>();
		expect(Object.keys(presences).sort()).toEqual([`inexistente-${RUN}`, other.user.id].sort());
		expect(presences[other.user.id].online).toBe(false);
	});
});
