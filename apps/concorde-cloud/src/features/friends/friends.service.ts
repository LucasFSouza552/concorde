import { Friend, FriendRelationshipState, SendFriendRequestResult, UserSocketServerMessage } from "@concorde/shared";
import { findUserByUsername, findFriendsByStatus, sendRequest as sendRequestRepo, acceptRequest as acceptRequestRepo, declineRequest as declineRequestRepo, removeFriend as removeFriendRepo, findFriendship, findRelationship, findIncomingRequests, findMutualFriendIds } from "./friends.repository";
import { getUserById } from "../auth/auth.repository";
import { deliverToUser } from "../calls/calls.service";
import { Env } from "../../types/Env";

import { AppError } from "../../utils/AppError";

export async function requireFriendship(db: D1Database, userId: string, friendId: string, message = "Ação permitida somente entre amigos."): Promise<void> {
	if (await findFriendship(db, userId, friendId)) return;

	const recipient = await getUserById(db, friendId);
	if (recipient && !recipient.friendsOnly) return;

	throw AppError.forbidden(message);
}

export async function searchUsers(db: D1Database, term: string): Promise<Friend[]> {
	const user = await findUserByUsername(db, term);
	return user ? [user] : [];
}

export async function listFriends(db: D1Database, userId: string): Promise<Friend[]> {
	return findFriendsByStatus(db, userId, "accepted");
}

export async function listRequests(db: D1Database, userId: string): Promise<Friend[]> {
	return findIncomingRequests(db, userId);
}

export async function getRelationship(
	db: D1Database,
	userId: string,
	targetId: string
): Promise<FriendRelationshipState> {
	if (userId === targetId) return "self";

	const target = await getUserById(db, targetId);
	if (!target) throw AppError.notFound("Usuário não encontrado");

	return findRelationship(db, userId, targetId);
}

export async function listMutualFriendIds(
	db: D1Database,
	userId: string,
	targetId: string
): Promise<string[]> {
	if (userId === targetId) return [];

	const target = await getUserById(db, targetId);
	if (!target) throw AppError.notFound("Usuário não encontrado");

	const relationship = await findRelationship(db, userId, targetId);
	if (target.friendsOnly && relationship !== "friend") return [];

	return findMutualFriendIds(db, userId, targetId);
}

type FriendEvent = Extract<UserSocketServerMessage, { type: "friends-changed" }>;
const FRIENDS_CHANGED: FriendEvent = { type: "friends-changed" };

async function notifyFriendsChanged(env: Env, userIds: string[]): Promise<void> {
	await Promise.all(userIds.map((id) =>
		deliverToUser(env, id, FRIENDS_CHANGED).catch(() => { })
	));
}

export async function sendRequest(db: D1Database, env: Env, userId: string, username: string): Promise<SendFriendRequestResult> {
	const target = await findUserByUsername(db, username);

	if (!target || !target.id) {
		throw AppError.notFound("Usuário não encontrado");
	}

	if (userId === target.id) {
		return "self";
	}

	const relationship = await findRelationship(db, userId, target.id);
	if (relationship === "friend") return "already-friends";
	if (relationship === "pending-out" || relationship === "pending-in") return "pending";

	await sendRequestRepo(db, userId, target.id);
	await notifyFriendsChanged(env, [target.id]);
	return "sent";
}

export async function acceptRequest(db: D1Database, env: Env, userId: string, friendId: string): Promise<void> {
	const accepted = await acceptRequestRepo(db, userId, friendId);

	if (!accepted) {
		throw AppError.notFound("Pedido não encontrado.");
	}

	await notifyFriendsChanged(env, [userId, friendId]);
}

export async function declineRequest(db: D1Database, env: Env, userId: string, friendId: string): Promise<void> {
	const declined = await declineRequestRepo(db, userId, friendId);

	if (!declined) {
		throw AppError.notFound("Pedido não encontrado.");
	}

	await notifyFriendsChanged(env, [userId, friendId]);
}

export async function removeFriend(db: D1Database, env: Env, userId: string, friendId: string): Promise<void> {
	const removed = await removeFriendRepo(db, userId, friendId);

	if (!removed) {
		throw AppError.notFound("Amizade não encontrada.");
	}

	await notifyFriendsChanged(env, [userId, friendId]);
}
