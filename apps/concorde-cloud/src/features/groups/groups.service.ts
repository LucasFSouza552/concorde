import { GroupRole, GroupWithRole } from "@concorde/shared";
import {
	countGroupOwners,
	countGroups,
	deleteGroupMember,
	findGroupById,
	findGroupMember,
	findGroupsForUser,
	insertGroupMember,
	insertGroupWithOwner,
	updateGroupMemberRole,
	listGroupMembers as listGroupMembersRepo
} from "./groups.repository";
import { getUserById } from "../auth/auth.repository";
import {
	findUserByUsername,
	findFriendship
} from "../friends/friends.repository";
import { requireFriendship } from "../friends/friends.service";

import { AppError } from "../../utils/AppError";

async function requireGroupRole(db: D1Database, groupId: string, userId: string, allowedRoles: GroupRole[]) {
	const membership = await findGroupMember(db, groupId, userId);
	if (!membership) {
		throw AppError.forbidden("Você não participa deste grupo.")
	}

	if (!allowedRoles.includes(membership.role)) {
		throw AppError.forbidden("Você não tem permissão para esta ação.");
	}

	return membership;
}

export async function createGroup(db: D1Database, userId: string, name: string) {
	const cleanName = name.trim();

	if (!cleanName) {
		throw AppError.badRequest("É necessário informar o nome do grupo.")
	}

	const groupsOwner = await countGroups(db, userId);
	if (groupsOwner >= 5) {
		throw AppError.forbidden("Você atingiu o limite de grupos que pode criar.");
	}

	const group = {
		id: crypto.randomUUID(),
		name: cleanName,
		ownerId: userId,
		createdAt: Date.now()
	};

	await insertGroupWithOwner(db, group);

	return group;
}

export async function listUserGroups(db: D1Database, userId: string): Promise<GroupWithRole[]> {
	return findGroupsForUser(db, userId);
}

export async function addGroupMember(db: D1Database, actorId: string, groupId: string, username: string, role: GroupRole = "member") {
	const group = await findGroupById(db, groupId);

	if (!group) {
		throw AppError.notFound("Grupo não encontrado");
	}

	await requireGroupRole(db, groupId, actorId, ["owner", "admin"]);

	if (role === "owner") {
		throw AppError.badRequest("Não é possível criar outro dono por aqui. A transferência de dono será uma separada.");
	}

	if (role === "admin") {
		throw AppError.badRequest("Não é possível criar outro dono por aqui. A transferência de dono será uma ação separada");
	}

	const target = await findUserByUsername(db, username);

	if (!target) {
		throw AppError.notFound("Usuário não encontrado.");
	}

	if (target.id === actorId) {
		throw AppError.badRequest("Você já participa deste grupo como responsável pela ação.");
	}

	const recipient = await getUserById(db, target.id);
	if (!recipient) throw AppError.notFound("Usuário não encontrado.");

	if (recipient.friendsOnly) {
		await requireFriendship(db, actorId, target.id, "Somente amigos podem ser adicionados ao grupo.");
	}

	const existing = await findGroupMember(db, groupId, target.id);

	if (existing) {
		throw AppError.conflict("Este usuário já participa do grupo.");
	}

	await insertGroupMember(db, {
		groupId,
		userId: target.id,
		role,
		joinedAt: Date.now()
	});
}

export async function removeGroupMember(db: D1Database, actorId: string, groupId: string, targetUserId: string) {
	const group = await findGroupById(db, groupId);

	if (!group) {
		throw AppError.notFound("Grupo não encontrado.");
	}

	await requireGroupRole(db, groupId, actorId, ["owner", "admin"]);

	const target = await findGroupMember(db, groupId, targetUserId);

	if (!target) {
		throw AppError.notFound("Membro não encontrado.");
	}

	if (target.role === "owner") {
		const owners = await countGroupOwners(db, groupId);

		if (owners <= 1) {
			throw AppError.badRequest(
				"Não é possível remover o único dono do grupo."
			);
		}

		await requireGroupRole(db, groupId, actorId, ["owner"]);
	}

	const removed = await deleteGroupMember(db, groupId, targetUserId);

	if (!removed) {
		throw AppError.notFound("Membro não encontrado.");
	}
}

export async function changeGroupMemberRole(db: D1Database, actorId: string, groupId: string, targetUserId: string, role: "admin" | "member") {
	const group = await findGroupById(db, groupId);

	if (!group) {
		throw AppError.notFound("Grupo não encontrado");
	}

	await requireGroupRole(db, groupId, actorId, ["owner"]);

	const target = await findGroupMember(db, groupId, targetUserId);
	if (!target) {
		throw AppError.notFound("Membro não encontrado");
	}

	if (target.role === "owner" && targetUserId === actorId) {
		const owners = await countGroupOwners(db, groupId);

		if (owners <= 1) {
			throw AppError.badRequest("O único dono não pode deixar de ser dono por aqui.")
		}
	}

	const updated = await updateGroupMemberRole(db, groupId, targetUserId, role);

	if (!updated) {
		throw AppError.notFound("Membro não encontrado.");
	}
}

export async function listGroupMembers(db: D1Database, actorId: string, groupId: string) {
	const membership = await findGroupMember(db, groupId, actorId);

	if (!membership) {
		throw AppError.forbidden("Somente membros podem ver a lista.");
	}

	return listGroupMembersRepo(db, groupId);
}
