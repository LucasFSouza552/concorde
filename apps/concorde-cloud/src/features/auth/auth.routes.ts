import { Hono } from "hono";

import { confirmTotpController, disableTotpController, enrollTotpController, forgotPasswordController, listSessionsController, loginController, logoutController, meController, refreshController, registerController, resetPasswordController, revokeSessionController, totpStatusController, updateEmailController, updatePasswordController, updateProfileController } from "./auth.controller";
import { discordApplyProfileController, discordAutoSyncController, discordCallbackController, discordEventsController, discordIntegrationController, discordLinkStartController, discordLoginStartController, discordRegisterController, discordReauthStartController, discordSetupPasswordController, discordShowcaseController, discordSyncStartController, discordUnlinkController } from "./discord.controller";
import { authMiddleware, optionalAuthMiddleware } from "../../middleware/auth";
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

auth.patch("/me/email", authMiddleware, rateLimitMiddleware("email-change", 5, 60_000), updateEmailController);

// 2FA: ativação em duas etapas + desativar com código.
auth.get("/me/totp", authMiddleware, totpStatusController);
auth.post("/me/totp/enroll", authMiddleware, rateLimitMiddleware("totp-enroll", 10, 60_000), enrollTotpController);
auth.post("/me/totp/confirm", authMiddleware, rateLimitMiddleware("totp-confirm", 10, 60_000), confirmTotpController);
auth.post("/me/totp/disable", authMiddleware, rateLimitMiddleware("totp-disable", 10, 60_000), disableTotpController);

// Sessões do usuário.
auth.get("/me/sessions", authMiddleware, listSessionsController);
auth.delete("/me/sessions/:id", authMiddleware, revokeSessionController);

// Discord OAuth2: o callback é público no login e usa sessão na vinculação.
auth.post("/discord/login/start", rateLimitMiddleware("discord-login-start", 10, 60_000), discordLoginStartController);
auth.post("/discord/link/start", authMiddleware, rateLimitMiddleware("discord-link-start", 10, 60_000), discordLinkStartController);
auth.post("/discord/sync/start", authMiddleware, rateLimitMiddleware("discord-sync-start", 10, 60_000), discordSyncStartController);
auth.post("/discord/reauth/start", authMiddleware, rateLimitMiddleware("discord-reauth-start", 10, 60_000), discordReauthStartController);
auth.post("/discord/callback", optionalAuthMiddleware, rateLimitMiddleware("discord-callback", 10, 60_000), discordCallbackController);
auth.post("/discord/register", rateLimitMiddleware("discord-register", 5, 60_000), discordRegisterController);
auth.get("/me/discord", authMiddleware, discordIntegrationController);
auth.get("/me/discord/events", authMiddleware, discordEventsController);
auth.patch("/me/discord/showcase", authMiddleware, rateLimitMiddleware("discord-showcase", 30, 60_000), discordShowcaseController);
auth.post("/me/discord/apply", authMiddleware, rateLimitMiddleware("discord-apply", 30, 60_000), discordApplyProfileController);
auth.patch("/me/discord/auto-sync", authMiddleware, rateLimitMiddleware("discord-auto-sync", 30, 60_000), discordAutoSyncController);
auth.delete("/me/discord", authMiddleware, rateLimitMiddleware("discord-unlink", 5, 60_000), discordUnlinkController);
auth.post("/me/password/setup", authMiddleware, rateLimitMiddleware("password-setup", 5, 60_000), discordSetupPasswordController);

export default auth;
