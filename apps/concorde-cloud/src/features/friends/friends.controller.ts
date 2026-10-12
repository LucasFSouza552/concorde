import { Context } from "hono";

import { isValidUsername } from "@concorde/shared";
import { acceptRequest, declineRequest, listFriends, listRequests, removeFriend, searchUsers, sendRequest } from "./friends.service";
import { Env } from "../../types/Env";

import { AppError } from "../../utils/AppError";

type AppContext = Context<{ Bindings: Env; Variables: { userId: string } }>;

export async function listFriendsController(c: AppContext) {
	const userId = c.get("userId");
	const friends = await listFriends(c.env.concorde_users, userId)
	return c.json({ friends }, 200);
}

export async function listRequestController(c: AppContext) {
	const userId = c.get("userId");
	const requests = await listRequests(c.env.concorde_users, userId);
	console.log(requests);
	return c.json({ requests }, 200);
}

export async function searchUsersController(c: AppContext) {
	const { search } = c.req.query();
	const users = await searchUsers(c.env.concorde_users, search ?? "");
	return c.json({ users }, 200);
}

export async function sendRequestController(c: AppContext) {
	const userId = c.get("userId");
	const body = await c.req.json<{ username: string }>();

	if (typeof body !== "object" || body === null || !("username" in body) || !isValidUsername(body.username)) {
		throw AppError.badRequest("É necessário informar um nome de usuário válido.");
	}

	const result = await sendRequest(c.env.concorde_users, userId, body.username);

	switch (result) {
		case "sent":
			return c.json({ status: result }, 201);
		case "self":
			return c.json({ message: "Você não pode adicionar a si mesmo." }, 409);
		case "pending":
			return c.json({ message: "Já existe um pedido pendente." }, 409);
		case "already-friends":
			return c.json({ message: "Vocês já são amigos." }, 409);
	}

}

export async function acceptRequestController(c: AppContext) {
	const userId = c.get("userId");
	const friendId = c.req.param("friendId");
	if (!friendId) throw AppError.badRequest("O ID do amigo é obrigatório");
	await acceptRequest(c.env.concorde_users, userId, friendId);
	return c.json({ status: "accepted" }, 200);
}

export async function declineRequestController(c: AppContext) {
	const userId = c.get("userId");
	const friendId = c.req.param("friendId");

	if (!friendId) throw AppError.badRequest("O ID do amigo é obrigatório");

	await declineRequest(c.env.concorde_users, userId, friendId);
	return c.json({ status: "removed" }, 200);
}

export async function removeFriendController(c: AppContext) {
	const userId = c.get("userId");
	const friendId = c.req.param("friendId");

	if (!friendId) throw AppError.badRequest("O ID do amigo é obrigatório");

	await removeFriend(c.env.concorde_users, userId, friendId);
	return c.json({ status: "removed" }, 200);
}
