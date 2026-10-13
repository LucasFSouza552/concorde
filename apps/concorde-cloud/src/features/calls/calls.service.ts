import { CallInvite, UserSocketServerMessage } from "@concorde/shared";
import { Env } from "../../types/Env";
import { getUserById } from "../auth/auth.repository";
import { getFriendship } from "../friends/friends.repository";

import { AppError } from "../../utils/AppError";

export const CALL_INVITE_TTL_MS = 30_000;

async function deliverToUser(env: Env, userId: string, message: UserSocketServerMessage): Promise<void> {
	const id = env.USER_SESSIONS.idFromName(userId);
	const stub = env.USER_SESSIONS.get(id);

	await stub.fetch("https://user-session/deliver", {
		method: "POST",
		body: JSON.stringify(message)
	});
}

export async function redirectCall(env: Env, callerId: string, callId: string, groupId: string) {
	if (!callId || !groupId) {
		throw AppError.badRequest("É nescessário informar a chamada e a sala.");
	}

	await relayCallEvent(env, callerId, { type: "call-redirect", callId, groupId });
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

	const direct = await getFriendship(db, fromUserId, toUserId);
	const reverse = await getFriendship(db, toUserId, fromUserId);

	if (direct?.status !== "accepted" && reverse?.status !== "accepted") {
		throw AppError.forbidden("Somente amigos podem ligar entre si.");
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