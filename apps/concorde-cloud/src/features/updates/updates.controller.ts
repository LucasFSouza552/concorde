import { Context } from "hono";

import { getVersionPolicy, listClients, reportClientVersion, setVersionPolicy } from "./updates.service";
import type { Env } from "../../types/Env";

import { AppError } from "../../utils/AppError";

type AppContext = Context<{ Bindings: Env; Variables: { userId: string } }>;

function requireAdminHeader(c: AppContext): string | undefined {
	return c.env.ADMIN_TOKEN;
}

export async function getPolicyController(c: AppContext) {
	const policy = await getVersionPolicy(c.env.concorde_users);
	return c.json({ policy }, 200);
}

export async function setPolicyController(c: AppContext) {
	const body = await c.req.json<{ minVersion?: string | null; latestVersion?: string | null }>();

	if (typeof body !== "object" || body === null
		|| !("minVersion" in body) && !("latestVersion" in body)) {
		throw AppError.badRequest("Informe minVersion e/ou latestVersion.");
	}

	const policy = await setVersionPolicy(c.env.concorde_users, requireAdminHeader(c), body);
	return c.json({ policy }, 200);
}

export async function reportVersionController(c: AppContext) {
	const userId = c.get("userId");
	const body = await c.req.json<{ version?: unknown }>();

	if (!body || typeof body !== "object"
		|| typeof body.version !== "string"
		|| !body.version.trim()) {
		throw AppError.badRequest("Informe a versão do app.");
	}

	await reportClientVersion(c.env.concorde_users, userId, body.version.trim());
	return c.json({ status: "reported" }, 200);
}

export async function listClientsController(c: AppContext) {
	const clients = await listClients(c.env.concorde_users, requireAdminHeader(c));
	return c.json({ clients, updatedAt: Date.now() }, 200);
}
