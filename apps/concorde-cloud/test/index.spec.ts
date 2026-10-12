import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

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
});
