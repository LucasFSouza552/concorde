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

export { CallSession };
export { UserSession };

const app = new Hono<{ Bindings: Env }>();

app.use("*", cors({
    origin: (origin) => {
        if (!origin || origin === "null") return "null";
        if (origin.startsWith("http://localhost:")) return origin;
        return null;
    }
}));

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

app.get("/call/:groupId", async (c) => {
	const id = c.env.CALL_SESSIONS.idFromName(c.req.param("groupId"));

	const stub = c.env.CALL_SESSIONS.get(id);

	return stub.fetch(c.req.raw);
});

// Upgrade para websocket
app.get("/user/:userId/socket", async (c) => {
	const id = c.env.USER_SESSIONS.idFromName(c.req.param("userId"));
	const stub = c.env.USER_SESSIONS.get(id);
	console.log("Conectado novo usuário", id);
	return stub.fetch(c.req.raw);
});

export default app;