import { Context } from "hono";

import { acceptCall, cancelCall, createCallInvite, createGroupCallInvite, declineCall, redirectCall } from "./calls.service";
import { Env } from "../../types/Env";

import { AppError } from "../../utils/AppError";

type AppContext = Context<{ Bindings: Env; Variables: { userId: string } }>;

export async function createCallController(c: AppContext) {
	const userId = c.get("userId");
	const body = await c.req.json<{ toUserId: string }>();

	if (typeof body?.toUserId !== "string") {
		throw AppError.badRequest("É necessário informar o destinatário.");
	}

	const invite = await createCallInvite(c.env, userId, body.toUserId);

	return c.json({ invite }, 201);
}

export async function acceptCallController(c: AppContext) {
	const callId = c.req.param("id");
	const body = await c.req.json<{ callerId: string }>();

	if (!callId || typeof body?.callerId !== "string") {
		throw AppError.badRequest("");
	}

	await acceptCall(c.env, body.callerId, callId);

	return c.json({ status: "accepted" }, 200);
}

export async function declineCallController(c: AppContext) {
	const callId = c.req.param("id");
	const body = await c.req.json<{ callerId: string }>();

	if (!callId || typeof body?.callerId !== "string") {
		throw AppError.badRequest("");
	}

	await declineCall(c.env, body.callerId, callId);

	return c.json({ status: "declined" }, 200);
}

export async function cancelCallController(c: AppContext) {
	const callId = c.req.param("id");
	const body = await c.req.json<{ toUserId: string }>();

	if (!callId || typeof body?.toUserId !== "string") {
		throw AppError.badRequest("");
	}

	await cancelCall(c.env, body.toUserId, callId);

	return c.json({ status: "cancelled" }, 200);
}

export async function redirectCallController(c: AppContext) {
	const callId = c.req.param("id");
	const body = await c.req.json<{ callerId: string; groupId: string; concordeGroupId?: string | null }>();

	if (!callId || typeof body?.callerId !== "string" || typeof body?.groupId !== "string") {
		throw AppError.badRequest("");
	}

	await redirectCall(c.env, body.callerId, callId, body.groupId, body.concordeGroupId ?? null);

	return c.json({ status: "redirected" }, 200);

}

export async function createGroupCallController(c: AppContext) {
	const userId = c.get("userId");
	const body = await c.req.json<{ toUserIds: string[]; concordeGroupId?: string }>();

	if (!body || !Array.isArray(body.toUserIds)) {
		throw AppError.badRequest("Informe os participantes.");
	}

	const { groupId, invites } = await createGroupCallInvite(c.env, userId, body.toUserIds, body.concordeGroupId);

	return c.json({ groupId, invites }, 201);
}
