import { NewChannel, NewMessage } from "@concorde/shared";
import {
	addChannelUser,
	createChannel,
	findChannelById,
	findChannelUser,
	findDMchannel,
	findOtherChannelUser,
	insertMessage,
	listChannelMembers as listChannelMembersRepo,
	listChannelMessages,
	listGroupChannelMembers
} from "./channels.repository";
import { Env } from "../../types/Env";
import { getUserById } from "../auth/auth.repository";
import { findFriendship } from "../friends/friends.repository";
import { requireFriendship } from "../friends/friends.service";
import { findGroupById, findGroupMember } from "../groups/groups.repository";

import { AppError } from "../../utils/AppError";

export async function resolveDMChannel(db: D1Database, userIdA: string, userIdB: string) {
	if (userIdA === userIdB) {
		throw AppError.badRequest("Você não pode criar uma conversa consigo mesmo");
	}

	const recipient = await getUserById(db, userIdB);
	if (!recipient) throw AppError.notFound("Usuário não encontrado.");

	if (recipient.friendsOnly) {
		await requireFriendship(db, userIdA, userIdB, "Somente amigos podem conversar entre si.");
	}

	const dmKey = [userIdA, userIdB].sort().join(":");

	const existing = await findDMchannel(db, dmKey);

	if (existing) return existing;

	const channel: NewChannel = {
		id: crypto.randomUUID(),
		groupId: null,
		kind: "dm",
		name: null,
		dmKey,
		createdAt: Date.now()
	};

	await createChannel(db, channel);
	await addChannelUser(db, channel.id, userIdA, channel.createdAt);
	await addChannelUser(db, channel.id, userIdB, channel.createdAt);

	return channel;
}

export async function sendMessage(env: Env, userId: string, channelId: string, content: string) {
	const db = env.concorde_users;
	const channel = await findChannelById(db, channelId);

	if (!channel) {
		throw AppError.notFound("Canal não encontrado");
	}

	const text = content.trim();

	if (!text) {
		throw AppError.badRequest("É necessário informar o conteúdo da mensagem");
	}

	await requireChannelAccess(db, userId, channel);

	if (channel.kind === "dm") {
		const other = await findOtherChannelUser(db, channelId, userId);

		if (!other) {
			throw AppError.forbidden("Conversa indisponível");
		}

		const recipient = await getUserById(db, other.userId);
		if (!recipient) throw AppError.notFound("Usuário não encontrado.");

		if (recipient.friendsOnly) {
			await requireFriendship(db, userId, other.userId, "Vocês não são amigos.");
		}
	}

	const message: NewMessage = {
		id: crypto.randomUUID(),
		channelId,
		userId,
		kind: "text",
		content: text,
		createdAt: Date.now()
	}

	await insertMessage(db, message);

	const members = await listChannelMembers(db, userId, channelId);

	for (const member of members) {
		if (member.id === userId) continue;

		const stub = env.USER_SESSIONS.get(env.USER_SESSIONS.idFromName(member.id));
		await stub.fetch("https://user-session/deliver", {
			method: "POST",
			body: JSON.stringify({ type: "channel-message", message })
		});
	}

	return message;

}

export async function listMessages(db: D1Database, userId: string, channelId: string, limit: number) {
	const channel = await findChannelById(db, channelId);

	if (!channel) {
		throw AppError.notFound("Canal não encontrado.")
	}

	await requireChannelAccess(db, userId, channel);

	return listChannelMessages(db, channelId, limit);
}

export async function createGroupChannel(db: D1Database, userId: string, groupId: string, name: string) {
	const group = await findGroupById(db, groupId);

	if (!group) {
		throw AppError.notFound("Grupo não encontrado")
	}

	const membership = await findGroupMember(db, groupId, userId);

	if (!membership) {
		throw AppError.forbidden("Você não participa deste grupo");
	}

	const cleanName = name.trim();

	if (!cleanName) {
		throw AppError.badRequest("É nescessário informar o ome do canal.")
	}

	const channel: NewChannel = {
		id: crypto.randomUUID(),
		groupId,
		kind: "group",
		name: cleanName,
		dmKey: null,
		createdAt: Date.now()
	}

	await createChannel(db, channel);

	return channel;

}

async function requireChannelAccess(
	db: D1Database,
	userId: string,
	channel: NewChannel
): Promise<void> {
	if (channel.kind === "dm") {
		const membership = await findChannelUser(db, channel.id, userId);

		if (!membership) {
			throw AppError.forbidden("Você não participa deste canal.");
		}

		return;
	}

	if (!channel.groupId) {
		throw AppError.internal("Canal de grupo sem grupo.");
	}

	const groupMembership = await findGroupMember(db, channel.groupId, userId);

	if (!groupMembership) {
		throw AppError.forbidden("Você não participa deste grupo.");
	}
}
export async function listChannelMembers(db: D1Database, userId: string, channelId: string) {
	const channel = await findChannelById(db, channelId);

	if (!channel) {
		throw AppError.notFound("Canal não encontrado.");
	}

	await requireChannelAccess(db, userId, channel);

	if (channel.kind === "dm") {
		return listChannelMembersRepo(db, channelId);
	}

	return listGroupChannelMembers(db, channel.groupId!);
}