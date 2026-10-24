import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";

import authRoutes from "./features/auth/auth.routes";
import callsRoutes from "./features/calls/calls.routes";
import channelsRoutes from "./features/channels/channels.routes";
import friendsRoutes from "./features/friends/friends.routes";
import groupsRoutes from "./features/groups/groups.routes";
import { CallSession } from "./CallSession";
import { Env } from "./types/Env";
import { UserSession } from "./UserSession";

import { AppError } from "./utils/AppError";
import { verifyToken } from "./utils/JWT";

import type { Context } from "hono";

export { CallSession };
export { UserSession };

const app = new Hono<{ Bindings: Env }>();

const apiCors = cors({
	origin: (origin) => {
		if (!origin || origin === "null") return "null";
		if (origin.startsWith("http://localhost:")) return origin;
		return null;
	}
});

app.use("*", async (c, next) => {
	if (c.req.header("Upgrade")?.toLowerCase() === "websocket") {
		await next();
		return;
	}
	return apiCors(c, next);
});

app.onError((err, c) => {
	if (err instanceof AppError || err instanceof HTTPException) {
		return c.json({ message: err.message }, err.status);
	}

	if (err instanceof SyntaxError) {
		return c.json(
			{ message: "Corpo da requisição inválido." },
			400
		);
	}
	console.error(err);

	return c.json({ message: "Erro interno do servidor." }, 500);
});

// Routes
app.route("/auth", authRoutes);
app.route("/friends", friendsRoutes);
app.route("/groups", groupsRoutes);
app.route("/channels", channelsRoutes);
app.route("/calls", callsRoutes)

/**
 * Valida o Bearer do chamador e devolve o userId verificado.
 * Erros de autenticação são 401; nenhuma exceção volta com token/payload.
 */
async function requireBearer(c: Context<{ Bindings: Env }>): Promise<string> {
	const authorization = c.req.header("Authorization");

	if (!authorization) {
		throw AppError.unauthorized("Token de acesso não foi enviado.");
	}

	const [scheme, token] = authorization.split(" ");

	if (scheme !== "Bearer" || !token) {
		throw AppError.unauthorized("Formato de token inválido.");
	}

	try {
		return await verifyToken(token, c.env.JWT_SECRET);
	} catch {
		throw AppError.unauthorized("Token inválido ou expirado.");
	}
}

/**
 * Repassa a request ao DO com a identidade verificada no header interno.
 * O header é sempre sobrescrito aqui — valores enviados pelo cliente
 * (ou proxy intermediário) nunca chegam ao DO.
 */
async function withVerifiedUser(c: Context<{ Bindings: Env }>, verifiedUserId: string): Promise<Request> {
	const request = new Request(c.req.raw);
	request.headers.set("x-verified-user", verifiedUserId);
	return request;
}

/**
 * WS de chamada: o navegador não pode setar headers no handshake de
 * WebSocket, então o token vem na query (wss://, não vaza em trânsito).
 * Requisições sem token rejeitam antes de acordar o Durable Object.
 */
app.get("/call/:groupId", async (c) => {
	const token = new URL(c.req.url).searchParams.get("token");

	if (!token) {
		throw AppError.unauthorized("É necessário informar o token de acesso.");
	}

	let verifiedUserId: string;

	try {
		verifiedUserId = await verifyToken(token, c.env.JWT_SECRET);
	} catch {
		throw AppError.unauthorized("Token inválido ou expirado.");
	}

	const id = c.env.CALL_SESSIONS.idFromName(c.req.param("groupId"));
	const stub = c.env.CALL_SESSIONS.get(id);

	return stub.fetch(await withVerifiedUser(c, verifiedUserId));
});

// Upgrade para websocket
app.get("/user/:userId/socket", async (c) => {
	const id = c.env.USER_SESSIONS.idFromName(c.req.param("userId"));
	const stub = c.env.USER_SESSIONS.get(id);
	return stub.fetch(c.req.raw);
});

// Presence: consulta restrita à identidade tratada pelo próprio DO
app.get("/user/:userId/presence", async (c) => {
	const verifiedUserId = await requireBearer(c);

	const id = c.env.USER_SESSIONS.idFromName(c.req.param("userId"));
	const stub = c.env.USER_SESSIONS.get(id);

	return stub.fetch(await withVerifiedUser(c, verifiedUserId));
});

// Presence em lote: 1 requisição em vez de N no sweep de segurança do cliente.
// A visibilidade por par continua sendo decidida dentro de cada DO alvo.
const MAX_PRESENCE_BATCH = 100;

const OFFLINE_PRESENCE_FALLBACK = {
	status: "offline",
	online: false,
	inCall: false,
	groupId: null,
	concordeGroupId: null
};

app.post("/user/presence/batch", async (c) => {
	const callerId = await requireBearer(c);

	const body = await c.req.json<{ ids?: unknown }>().catch(() => ({ ids: undefined }));

	if (
		!Array.isArray(body.ids) ||
		body.ids.length === 0 ||
		body.ids.length > MAX_PRESENCE_BATCH ||
		!body.ids.every((id) => typeof id === "string")
	) {
		throw AppError.badRequest(`Envie de 1 a ${MAX_PRESENCE_BATCH} ids.`);
	}

	const targets = [...new Set(body.ids as string[])];

	const entries = await Promise.all(targets.map(async (id) => {
		const stub = c.env.USER_SESSIONS.get(c.env.USER_SESSIONS.idFromName(id));

		try {
			const response = await stub.fetch(await withVerifiedUser(c, callerId));
			return [id, await response.json()] as const;
		} catch {
			// Sem vazamento em falha: forma offline genérica também aqui.
			return [id, OFFLINE_PRESENCE_FALLBACK] as const;
		}
	}));

	return c.json({ presences: Object.fromEntries(entries) });
});

export default app;