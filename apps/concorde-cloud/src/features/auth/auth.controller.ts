import { Context } from "hono";

import { AppError } from "../../utils/AppError";
import { Env } from "../../types/Env";

import { changeProfile, changePassword, confirmTotpEnrollment, disableTotp, enrollTotp, getTotpStatus, getCurrentUser, listUserSessionsForApi, loginUser, logoutSession, refreshSession, registerUser, requestPasswordReset, resetPasswordWithCode, revokeUserSessionById } from "./auth.service";

export async function registerController(c: Context) {

	const data = await c.req.json();

	const user = await registerUser(c.env.concorde_users, c.env.JWT_SECRET, data, c.req.header("User-Agent") ?? undefined);

	return c.json(user, 201);
}

export async function loginController(c: Context) {
	const data = await c.req.json();
	const user = await loginUser(c.env.concorde_users, c.env.JWT_SECRET, data, c.req.header("User-Agent") ?? undefined);

	return c.json(user);
}

export async function forgotPasswordController(c: Context) {
	const body = await c.req.json<{ email?: unknown }>().catch(() => ({ email: undefined }));

	const result = await requestPasswordReset(c.env.concorde_users, c.env, body?.email);

	return c.json(result);
}

export async function resetPasswordController(c: Context) {
	const body = await c.req.json<{ email?: unknown; code?: unknown; newPassword?: unknown }>().catch(() => ({ email: undefined, code: undefined, newPassword: undefined }));

	await resetPasswordWithCode(c.env.concorde_users, body?.email, body?.code, body?.newPassword);

	return c.json({ status: "password-changed" });
}

export async function refreshController(c: Context) {
	const body = await c.req.json<{ refreshToken?: unknown }>().catch(() => ({ refreshToken: undefined }));

	const result = await refreshSession(c.env.concorde_users, c.env.JWT_SECRET, body?.refreshToken);

	return c.json(result);
}

export async function logoutController(c: Context<{ Bindings: Env; Variables: { userId?: string } }>) {
	const body = await c.req.json<{ refreshToken?: unknown }>().catch(() => ({ refreshToken: undefined }));

	let userId: string | null = null;
	const authorization = c.req.header("Authorization");

	if (authorization?.startsWith("Bearer ")) {
		try {
			const { verifyToken } = await import("../../utils/JWT");
			userId = await verifyToken(authorization.slice("Bearer ".length), c.env.JWT_SECRET);
		} catch {
			userId = null;
		}
	}

	await logoutSession(c.env.concorde_users, userId, body?.refreshToken);

	return c.json({ status: "logged-out" });
}

export async function meController(c: Context<{ Bindings: Env; Variables: { userId: string } }>) {
	const user = await getCurrentUser(c.env.concorde_users, c.get("userId"));

	return c.json(user);
}

export async function updateProfileController(c: Context<{ Bindings: Env; Variables: { userId: string } }>) {
	const userId = c.get("userId");
	const body = await c.req
		.json<{ displayName?: unknown; avatar?: unknown; bannerFrom?: unknown; bannerTo?: unknown }>()
		.catch(() => ({ displayName: undefined }));

	// Foto/grande volume tem limite de frequência no próprio endpoint.
	const user = await changeProfile(c.env.concorde_users, userId, body);

	return c.json(user);
}

export async function updatePasswordController(c: Context<{ Bindings: Env; Variables: { userId: string } }>) {
	const userId = c.get("userId");
	const body = await c.req.json<{ currentPassword?: unknown; newPassword?: unknown }>().catch(() => ({ currentPassword: undefined, newPassword: undefined }));

	await changePassword(c.env.concorde_users, userId, body?.currentPassword, body?.newPassword);

	return c.json({ status: "updated" });
}

export async function totpStatusController(c: Context<{ Bindings: Env; Variables: { userId: string } }>) {
	const status = await getTotpStatus(c.env.concorde_users, c.get("userId"));

	return c.json(status);
}

export async function enrollTotpController(c: Context<{ Bindings: Env; Variables: { userId: string } }>) {
	const enrollment = await enrollTotp(c.env.concorde_users, c.get("userId"));

	return c.json(enrollment);
}

export async function confirmTotpController(c: Context<{ Bindings: Env; Variables: { userId: string } }>) {
	const body = await c.req.json<{ code?: unknown }>().catch(() => ({ code: undefined }));

	await confirmTotpEnrollment(c.env.concorde_users, c.get("userId"), body?.code);

	return c.json({ status: "confirmed", totpEnabled: true });
}

export async function disableTotpController(c: Context<{ Bindings: Env; Variables: { userId: string } }>) {
	const body = await c.req.json<{ code?: unknown }>().catch(() => ({ code: undefined }));

	await disableTotp(c.env.concorde_users, c.get("userId"), body?.code);

	return c.json({ status: "disabled", totpEnabled: false });
}

export async function listSessionsController(c: Context<{ Bindings: Env; Variables: { userId: string } }>) {
	const sessions = await listUserSessionsForApi(c.env.concorde_users, c.get("userId"));

	return c.json({ sessions });
}

export async function revokeSessionController(c: Context<{ Bindings: Env; Variables: { userId: string } }>) {
	const sessionId = c.req.param("id") as string;

	await revokeUserSessionById(c.env.concorde_users, c.get("userId"), sessionId);

	return c.json({ status: "revoked" });
}