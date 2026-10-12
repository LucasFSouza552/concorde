import { Hono } from "hono";

import { loginController, meController, registerController } from "./auth.controller";
import { authMiddleware } from "../../middleware/auth";
import type { Env } from "../../types/Env";

const auth = new Hono<{ Bindings: Env; Variables: { userId: string }}>();

auth.get("/", async (c) => {
	return c.json({ status: "ok", route: "auth" });
});

auth.get("/users", async (c) => {
	const users = await c.env.concorde_users.prepare("SELECT * FROM users").all();
	return c.json(users, 200);
});

auth.post("/login", loginController);

auth.post("/register", registerController);

auth.get("/me", authMiddleware, meController);

export default auth;
