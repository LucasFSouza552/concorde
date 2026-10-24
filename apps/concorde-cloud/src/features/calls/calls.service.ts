import { CallInvite, UserSocketServerMessage } from "@concorde/shared";
import { Env } from "../../types/Env";
import { getUserById } from "../auth/auth.repository";
import { findFriendship } from "../friends/friends.repository";
import { requireFriendship } from "../friends/friends.service";
import { findGroupMember } from "../groups/groups.repository";

import { AppError } from "../../utils/AppError";

export const CALL_INVITE_TTL_MS = 30_000;
export const GROUP_CALL_MAX_MEMBERS = 6;

export async function deliverToUser(env: Env, userId: string, message: UserSocketServerMessage): Promise<void> {
	const id = env.USER_SESSIONS.idFromName(userId);
	const stub = env.USER_SESSIONS.get(id);

	await stub.fetch("https://user-session/deliver", {
		method: "POST",
		body: JSON.stringify(message)
	});
}

export async function createCallInvite(env: Env, fromUserId: string, toUserId: string) {
	const db = env.concorde_users;
	if (!toUserId) {
		throw AppError.badRequest("Informe quem você deseja chamar.");
	}

	if (fromUserId === toUserId) {
		throw AppError.conflict("Não é possível iniciar uma chamada consigo mesmo.");
	}

	const toUser = await getUserById(db, toUserId);

	if (!toUser) throw AppError.notFound("Usuário não encontrado.");

	if (toUser.friendsOnly) {
		await requireFriendship(db, fromUserId, toUserId);
	}

	const fromUser = await getUserById(db, fromUserId);
	if (!fromUser) {
		throw AppError.notFound("Usuário não encontrado.");
	}
	const now = Date.now();
	const invite: CallInvite = {
		callId: crypto.randomUUID(),
		groupId: crypto.randomUUID(),
		fromUserId,
		fromDisplayName: fromUser.displayName,
		createdAt: now,
		expiresAt: now + CALL_INVITE_TTL_MS
	};
	await deliverToUser(env, toUserId, { type: "call-invite", invite });

	return invite;

}

async function relayCallEvent(env: Env, toUserId: string, message: UserSocketServerMessage): Promise<void> {
	if (!toUserId) {
		throw AppError.badRequest("É necessário informar o destinatário.");
	}

	await deliverToUser(env, toUserId, message);
}

export async function acceptCall(env: Env, callerId: string, callId: string): Promise<void> {
	if (!callId) {
		throw AppError.badRequest("É necessário informar a chamada.");
	}

	await relayCallEvent(env, callerId, { type: "call-accepted", callId });
}

export async function declineCall(env: Env, callerId: string, callId: string): Promise<void> {
	if (!callId) {
		throw AppError.badRequest("É necessário informar a chamada.");
	}

	await relayCallEvent(env, callerId, { type: "call-declined", callId });
}

export async function cancelCall(env: Env, toUserId: string, callId: string): Promise<void> {
	if (!callId) {
		throw AppError.badRequest("É necessário informar a chamada.");
	}

	await relayCallEvent(env, toUserId, { type: "call-cancelled", callId });
}

export interface GroupCallInviteResult {
	groupId: string;
	invites: (CallInvite & { toUserId: string })[];
}

export async function createGroupCallInvite(env: Env, fromUserId: string, toUserId: string[], concordeGroupId?: string): Promise<GroupCallInviteResult> {
	const targets = [...new Set(toUserId.filter(id => id && id !== fromUserId))];

	if (targets.length === 0) {
		throw AppError.badRequest("Informe ao menos um participante");
	}

	if (targets.length > GROUP_CALL_MAX_MEMBERS && !concordeGroupId) {
		throw AppError.badRequest(`Limite de ${GROUP_CALL_MAX_MEMBERS} participantes por chamada.`);
	}

	const db = env.concorde_users;
	const fromUser = await getUserById(db, fromUserId);
	if (!fromUser) throw AppError.notFound("Usuário não encontrado.");

	if (concordeGroupId) {
		// Chamada de grupo: a permissão vem do grupo, não de amizade direta.
		const callerMembership = await findGroupMember(db, concordeGroupId, fromUserId);
		if (!callerMembership) {
			throw AppError.forbidden("Você não participa deste grupo.");
		}
	}

	const deliverable: { toUserId: string; toDisplayName: string }[] = [];

	for (const toUserId of targets) {
		const toUser = await getUserById(db, toUserId);
		if (!toUser) continue;

		if (toUser.friendsOnly && !concordeGroupId) {
			try {
				await requireFriendship(db, fromUserId, toUserId, "Somente amigos podem participar da chamada.");
			} catch {
				// Não é amigo e sem grupo: apenas não recebe o convite.
				continue;
			}
		}

		if (concordeGroupId) {
			const membership = await findGroupMember(db, concordeGroupId, toUserId);

			// Não é membro do grupo: não recebe o convite.
			if (!membership) continue;

			// friendsOnly não bloqueia convites de grupo.
		}

		deliverable.push({ toUserId, toDisplayName: toUser.displayName });
	}

	if (deliverable.length === 0) {
		throw AppError.badRequest("Nenhum participante elegível para a chamada.");
	}

	const now = Date.now();
	const groupId = crypto.randomUUID();
	const invites: GroupCallInviteResult["invites"] = [];

	for (const target of deliverable) {
		const invite: CallInvite = {
			callId: crypto.randomUUID(),
			groupId,
			fromUserId,
			fromDisplayName: fromUser.displayName,
			concordeGroupId,
			createdAt: now,
			expiresAt: now + CALL_INVITE_TTL_MS
		};
		invites.push({ ...invite, toUserId: target.toUserId });
		await deliverToUser(env, target.toUserId, { type: "call-invite", invite });
	}

	return { groupId, invites };

}
