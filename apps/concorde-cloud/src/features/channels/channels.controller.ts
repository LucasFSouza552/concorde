import { Context } from "hono";

import { listUserChannels } from "./channels.repository";
import { createGroupChannel, deleteMessage, listChannelMembers, listMessages, resolveDMChannel, sendMessage } from "./channels.service";
import { Env } from "../../types/Env";

import { AppError } from "../../utils/AppError";

type AppContext = Context<{ Bindings: Env; Variables: { userId: string } }>;

export async function resolveDMChannelController(c: AppContext) {
	const userId = c.get("userId");
	const body = await c.req.json<{ toUserId: string }>();

	if (typeof body?.toUserId !== "string" || !body.toUserId) {
		throw AppError.badRequest("É necessário informar o destinatário.");
	}

	const channel = await resolveDMChannel(c.env.concorde_users, userId, body.toUserId);
	return c.json({ channel }, 200);
}

export async function listChannelsController(c: AppContext) {
	const userId = c.get("userId");
	const channels = await listUserChannels(c.env.concorde_users, userId);

	return c.json({ channels }, 200);
}

export async function createGroupChannelController(c: AppContext) {
	const userId = c.get("userId");
	const body = await c.req.json<{ groupId: string, name: string }>();

	if (typeof body?.groupId !== "string" || typeof body?.name !== "string" || !body.groupId || !body.name) {
		throw AppError.badRequest("É necessário informar o grupo e nome do grupo");
	}

	const group = await createGroupChannel(c.env.concorde_users, userId, body.groupId, body.name);
	return c.json({ channel: group });
}

export async function sendMessageController(c: AppContext) {
	const userId = c.get("userId");
	const channelId = c.req.param("id");
	const body = await c.req.json<{ content: string }>();

	if (!channelId) {
		throw AppError.badRequest("O ID do canal é obrigatório.");
	}

	if (typeof body?.content !== "string" || !body.content.trim()) {
		throw AppError.badRequest("É necessário informar o conteúdo");
	}

	const message = await sendMessage(c.env, userId, channelId, body.content);

	return c.json({ message }, 201);
}

export async function listMessagesController(c: AppContext) {
	const userId = c.get("userId");
	const channelId = c.req.param("id");
	const { limit: limitQuery } = c.req.query();

	if (!channelId) {
		throw AppError.badRequest("O ID do canal é obrigatório.");
	}

	const parsed = Number(limitQuery);
	const limit = !parsed || parsed <= 0 ? 50 : Math.min(parsed, 100);

	const messages = await listMessages(c.env.concorde_users, userId, channelId, limit);

	return c.json({ messages }, 200);
}

export async function deleteMessageController(c: AppContext) {
	const userId = c.get("userId");
	const channelId = c.req.param("id");
	const messageId = c.req.param("messageId");

	if (!channelId || !messageId) {
		throw AppError.badRequest("O ID do canal e da mensagem são obrigatórios.");
	}

	const result = await deleteMessage(c.env, userId, channelId, messageId);

	return c.json({ deleted: result.id }, 200);
}

export async function listChannelMembersController(c: AppContext) {
	const userId = c.get("userId");
	const channelId = c.req.param("id");

	if (!channelId) {
		throw AppError.badRequest("O ID do canal é obrigatório.");
	}

	const members = await listChannelMembers(c.env.concorde_users, userId, channelId);

	return c.json({ members }, 200);
}