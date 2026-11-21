import type { Context } from "hono";

import {
	applyDiscordProfile,
	completeDiscordRegistration,
	getDiscordEventHistory,
	getDiscordIntegration,
	handleDiscordCallback,
	setDiscordAutoSyncEnabled,
	setDiscordProfileShowcase,
	setInitialPassword,
	startDiscordOAuth,
	startDiscordReauth,
	startDiscordSync,
	unlinkDiscord
} from "./discord.service";
import type { DiscordSensitiveAction } from "@concorde/shared";
import { AppError } from "../../utils/AppError";

function userAgent(c: Context): string | undefined {
	return c.req.header("User-Agent") ?? undefined;
}

function currentUserId(c: Context): string {
	return c.get("userId") as string;
}

export async function discordLoginStartController(c: Context) {
	return c.json(await startDiscordOAuth(c.env.concorde_users, c.env, "login", null));
}

export async function discordLinkStartController(c: Context) {
	return c.json(await startDiscordOAuth(c.env.concorde_users, c.env, "link", currentUserId(c)));
}

export async function discordCallbackController(c: Context) {
	const body = await c.req.json<{ code?: unknown; state?: unknown; iss?: unknown }>()
		.catch(() => ({ code: undefined, state: undefined, iss: undefined }));
	const userId = (c.get("userId") as string | undefined) ?? null;

	return c.json(await handleDiscordCallback(
		c.env.concorde_users,
		c.env,
		{ code: body?.code, state: body?.state, iss: body?.iss },
		userId,
		userAgent(c)
	));
}

export async function discordRegisterController(c: Context) {
	const body = await c.req.json<{ ticket?: unknown; username?: unknown; displayName?: unknown }>()
		.catch(() => ({ ticket: undefined, username: undefined, displayName: undefined }));
	const session = await completeDiscordRegistration(
		c.env.concorde_users,
		c.env,
		{ ticket: body?.ticket, username: body?.username, displayName: body?.displayName },
		userAgent(c)
	);

	return c.json(session, 201);
}

export async function discordIntegrationController(c: Context) {
	return c.json(await getDiscordIntegration(c.env.concorde_users, currentUserId(c)));
}

export async function discordUnlinkController(c: Context) {
	return c.json(await unlinkDiscord(c.env.concorde_users, currentUserId(c)));
}

export async function discordSetupPasswordController(c: Context) {
	const body = await c.req.json<{ password?: unknown }>().catch(() => ({ password: undefined }));

	return c.json(await setInitialPassword(c.env.concorde_users, currentUserId(c), body?.password));
}

export async function discordSyncStartController(c: Context) {
	return c.json(await startDiscordSync(c.env.concorde_users, c.env, currentUserId(c)));
}

export async function discordReauthStartController(c: Context) {
	const body = await c.req.json<{ action?: unknown }>().catch(() => ({ action: undefined }));

	if (body?.action !== "email" && body?.action !== "password") {
		throw AppError.badRequest("Ação sensível inválida.");
	}

	return c.json(await startDiscordReauth(
		c.env.concorde_users,
		c.env,
		currentUserId(c),
		body.action as DiscordSensitiveAction
	));
}

export async function discordEventsController(c: Context) {
	return c.json({ events: await getDiscordEventHistory(c.env.concorde_users, currentUserId(c)) });
}

export async function discordShowcaseController(c: Context) {
	const body = await c.req.json<{ enabled?: unknown }>().catch(() => ({ enabled: undefined }));

	return c.json(await setDiscordProfileShowcase(c.env.concorde_users, currentUserId(c), body?.enabled));
}

export async function discordApplyProfileController(c: Context) {
	return c.json(await applyDiscordProfile(c.env.concorde_users, currentUserId(c)));
}

export async function discordAutoSyncController(c: Context) {
	const body = await c.req.json<{ enabled?: unknown }>().catch(() => ({ enabled: undefined }));

	return c.json(await setDiscordAutoSyncEnabled(c.env.concorde_users, currentUserId(c), body?.enabled));
}
