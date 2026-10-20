import type { Context } from "hono";

import { isValidUsername, sanitizeUsername } from "@concorde/shared";
import {
	addGroupMember,
	changeGroupMemberRole,
	createGroup,
	dissolveGroup,
	leaveGroup,
	listGroupMembers,
	listUserGroups,
	removeGroupMember
} from "./groups.service";
import type { Env } from "../../types/Env";

import { AppError } from "../../utils/AppError";

type AppContext = Context<{ Bindings: Env; Variables: { userId: string } }>;

export async function createGroupController(c: AppContext) {
	const userId = c.get("userId");
	const body = await c.req.json<{ name: string }>();

	if (typeof body?.name !== "string") {
		throw AppError.badRequest("É necessário informar o nome do grupo.");
	}

	const group = await createGroup(c.env.concorde_users, userId, body.name);

	return c.json({ group }, 201);
}

export async function listGroupsController(c: AppContext) {
	const userId = c.get("userId");
	const groups = await listUserGroups(c.env.concorde_users, userId);

	return c.json({ groups }, 200);
}

export async function listGroupMembersController(c: AppContext) {
	const userId = c.get("userId");
	const groupId = c.req.param("groupId");

	if (!groupId) throw AppError.badRequest("");

	const members = await listGroupMembers(c.env.concorde_users, userId, groupId);

	return c.json({ members }, 200);
}

export async function addGroupMemberController(c: AppContext) {
	const actorId = c.get("userId");
	const groupId = c.req.param("groupId");
	const body = await c.req.json<{ username: string }>();

	if (!groupId) {
		throw AppError.badRequest("O ID do grupo é obrigatório.");
	}

	if (!body || !isValidUsername(body.username)) {
		throw AppError.badRequest("É necessário informar um nome de usuário válido.");
	}

	body.username = sanitizeUsername(body.username);

	await addGroupMember(
		c.env.concorde_users,
		actorId,
		groupId,
		body.username,
		"member"
	);

	return c.json({ status: "added" }, 201);
}

export async function removeGroupMemberController(c: AppContext) {
	const actorId = c.get("userId");
	const groupId = c.req.param("groupId");
	const targetUserId = c.req.param("userId");

	if (!groupId || !targetUserId) {
		throw AppError.badRequest("Grupo e membro são obrigatórios.");
	}

	await removeGroupMember(
		c.env.concorde_users,
		actorId,
		groupId,
		targetUserId
	);

	return c.json({ status: "removed" }, 200);
}

export async function changeGroupMemberRoleController(c: AppContext) {
	const actorId = c.get("userId");
	const groupId = c.req.param("groupId");
	const targetUserId = c.req.param("userId");
	const body = await c.req.json<{ role: "admin" | "member" }>();

	if (!groupId || !targetUserId) {
		throw AppError.badRequest("Grupo e membro são obrigatórios.");
	}

	if (body?.role !== "admin" && body?.role !== "member") {
		throw AppError.badRequest("Cargo inválido.");
	}

	await changeGroupMemberRole(
		c.env.concorde_users,
		actorId,
		groupId,
		targetUserId,
		body.role
	);

	return c.json({ status: "updated" }, 200);
}

export async function leaveGroupController(c: AppContext) {
	const userId = c.get("userId");
	const groupId = c.req.param("groupId");

	if (!groupId) {
		throw AppError.badRequest("Grupo é obrigatório.");
	}

	await leaveGroup(c.env.concorde_users, groupId, userId);

	return c.json({ status: "left" }, 200);
}

export async function dissolveGroupController(c: AppContext) {
	const userId = c.get("userId");
	const groupId = c.req.param("groupId");

	if (!groupId) {
		throw AppError.badRequest("Grupo é obrigatório.");
	}

	await dissolveGroup(c.env.concorde_users, groupId, userId);

	return c.json({ status: "dissolved" }, 200);
}