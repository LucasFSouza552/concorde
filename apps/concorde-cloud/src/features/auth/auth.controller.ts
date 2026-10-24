import { Context } from "hono";

import { AppError } from "../../utils/AppError";
import { Env } from "../../types/Env";

import { changeDisplayName, changePassword, getCurrentUser, loginUser, logoutSession, refreshSession, registerUser } from "./auth.service";

export async function registerController(c: Context) {

	const data = await c.req.json();

	const user = await registerUser(c.env.concorde_users, c.env.JWT_SECRET, data);

	return c.json(user, 201);
}

export async function loginController(c: Context) {
	const data = await c.req.json();
	const user = await loginUser(c.env.concorde_users, c.env.JWT_SECRET, data);
	return c.json(user);

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
	const body = await c.req.json<{ displayName?: unknown }>().catch(() => ({ displayName: undefined }));

	const user = await changeDisplayName(c.env.concorde_users, userId, body?.displayName);

	return c.json(user);
}

export async function updatePasswordController(c: Context<{ Bindings: Env; Variables: { userId: string } }>) {
	const userId = c.get("userId");
	const body = await c.req.json<{ currentPassword?: unknown; newPassword?: unknown }>().catch(() => ({ currentPassword: undefined, newPassword: undefined }));

	await changePassword(c.env.concorde_users, userId, body?.currentPassword, body?.newPassword);

	return c.json({ status: "updated" });
}