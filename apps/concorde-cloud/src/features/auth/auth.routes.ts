import { Hono } from "hono";

import { loginController, meController, registerController, updatePasswordController, updateProfileController } from "./auth.controller";
import { authMiddleware } from "../../middleware/auth";
import type { Env } from "../../types/Env";

const auth = new Hono<{ Bindings: Env; Variables: { userId: string }}>();

auth.get("/", async (c) => {
	return c.json({ status: "ok", route: "auth" });
});

auth.post("/login", loginController);

auth.post("/register", registerController);

auth.get("/me", authMiddleware, meController);

auth.patch("/me", authMiddleware, updateProfileController);

auth.post("/me/password", authMiddleware, updatePasswordController);

export default auth;
