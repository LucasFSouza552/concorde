import { Friend, SendFriendRequestResult } from "@concorde/shared";
import { findUserByUsername, findFriendsByStatus, sendRequest as sendRequestRepo, acceptRequest as acceptRequestRepo, declineRequest as declineRequestRepo, removeFriend as removeFriendRepo, findFriendship, findIncomingRequests } from "./friends.repository";
import { getUserById } from "../auth/auth.repository";

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

export async function sendRequest(db: D1Database, userId: string, username: string): Promise<SendFriendRequestResult> {
	const target = await findUserByUsername(db, username);

	if (!target || !target.id) {
		throw AppError.notFound("Usuário não encontrado");
	}

	if (userId === target.id) {
		return "self";
	}

	const existing = await findFriendship(db, userId, target.id);
	if (existing?.status === "accepted") return "already-friends";
	if (existing?.status === "pending") return "pending";

	const reverse = await findFriendship(db, target.id, userId);
	if (reverse?.status === "accepted") return "already-friends";
	if (reverse?.status === "pending") return "pending";

	await sendRequestRepo(db, userId, target.id);
	return "sent";
}

export async function acceptRequest(db: D1Database, userId: string, friendId: string): Promise<void> {
	const accepted = await acceptRequestRepo(db, userId, friendId);

	if (!accepted) {
		throw AppError.notFound("Pedido não encontrado.");
	}
}

export async function declineRequest(db: D1Database, userId: string, friendId: string): Promise<void> {
	const declined = await declineRequestRepo(db, userId, friendId);

	if (!declined) {
		throw AppError.notFound("Pedido não encontrado.");
	}
}

export async function removeFriend(db: D1Database, userId: string, friendId: string): Promise<void> {
	const removed = await removeFriendRepo(db, userId, friendId);

	if (!removed) {
		throw AppError.notFound("Amizade não encontrada.");
	}
}
