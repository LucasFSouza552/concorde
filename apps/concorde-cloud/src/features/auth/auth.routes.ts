import { Hono } from "hono";

import { confirmTotpController, disableTotpController, enrollTotpController, forgotPasswordController, listSessionsController, loginController, logoutController, meController, refreshController, registerController, resetPasswordController, revokeSessionController, totpStatusController, updatePasswordController, updateProfileController } from "./auth.controller";
import { authMiddleware } from "../../middleware/auth";
import { rateLimitMiddleware } from "../../utils/rate-limit";
import type { Env } from "../../types/Env";

const auth = new Hono<{ Bindings: Env; Variables: { userId: string }}>();

auth.get("/", async (c) => {
	return c.json({ status: "ok", route: "auth" });
});

// Janelas estreitas nos endpoints públicos (força bruta leve demais não passa).
auth.post("/login", rateLimitMiddleware("login", 10, 60_000), loginController);

auth.post("/register", rateLimitMiddleware("register", 5, 60_000), registerController);

// Recuperação de senha: código de 6 dígitos por email (uso único, 15 min).
auth.post("/forgot-password", rateLimitMiddleware("forgot-password", 5, 15 * 60_000), forgotPasswordController);
auth.post("/reset-password", rateLimitMiddleware("reset-password", 10, 60_000), resetPasswordController);

auth.post("/refresh", rateLimitMiddleware("refresh", 60, 60_000), refreshController);

auth.post("/refresh", refreshController);

auth.post("/logout", logoutController);

auth.get("/me", authMiddleware, meController);

auth.patch("/me", authMiddleware, rateLimitMiddleware("profile", 30, 60_000), updateProfileController);

auth.post("/me/password", authMiddleware, updatePasswordController);

// 2FA: ativação em duas etapas + desativar com código.
auth.get("/me/totp", authMiddleware, totpStatusController);
auth.post("/me/totp/enroll", authMiddleware, rateLimitMiddleware("totp-enroll", 10, 60_000), enrollTotpController);
auth.post("/me/totp/confirm", authMiddleware, rateLimitMiddleware("totp-confirm", 10, 60_000), confirmTotpController);
auth.post("/me/totp/disable", authMiddleware, rateLimitMiddleware("totp-disable", 10, 60_000), disableTotpController);

// Sessões do usuário.
auth.get("/me/sessions", authMiddleware, listSessionsController);
auth.delete("/me/sessions/:id", authMiddleware, revokeSessionController);

export default auth;
