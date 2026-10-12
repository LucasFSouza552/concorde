import { GroupRole, GroupWithRole } from "@concorde/shared";

export interface NewGroup {
	id: string;
	name: string;
	ownerId: string;
	createdAt: number;
}

export interface GroupRecord extends NewGroup { }

export interface GroupMemberRecord {
	groupId: string;
	userId: string;
	role: GroupRole;
	joinedAt: number;
}

export async function insertGroupWithOwner(db: D1Database, group: NewGroup) {
	await db.batch([
		db.prepare(
			`INSERT INTO groups (id, name, ownerId, createdAt)
       VALUES (?, ?, ?, ?)`
		).bind(group.id, group.name, group.ownerId, group.createdAt),
		db.prepare(
			`INSERT INTO group_members (groupId, userId, role, joinedAt)
       VALUES (?, ?, 'owner', ?)`
		).bind(group.id, group.ownerId, group.createdAt)
	]);
}

export async function findGroupById(db: D1Database, groupId: string): Promise<GroupRecord | null> {
	return db.prepare(
		`SELECT id, name, ownerId, createdAt
     FROM groups
     WHERE id = ?`
	)
		.bind(groupId)
		.first<GroupRecord>();
}

export async function findGroupsForUser(db: D1Database, userId: string): Promise<GroupWithRole[]> {
	const { results } = await db.prepare(
		`SELECT
       g.id,
       g.name,
       g.ownerId,
       g.createdAt,
       m.role,
       m.joinedAt
     FROM group_members m
     JOIN groups g ON g.id = m.groupId
     WHERE m.userId = ?
     ORDER BY g.createdAt DESC`
	)
		.bind(userId)
		.all<GroupWithRole>();

	return results ?? [];
}

export async function findGroupMember(db: D1Database, groupId: string, userId: string): Promise<GroupMemberRecord | null> {
	return db.prepare(
		`SELECT groupId, userId, role, joinedAt
     FROM group_members
     WHERE groupId = ? AND userId = ?`
	)
		.bind(groupId, userId)
		.first<GroupMemberRecord>();
}

export async function insertGroupMember(db: D1Database, member: GroupMemberRecord): Promise<void> {
	await db.prepare(
		`INSERT INTO group_members (groupId, userId, role, joinedAt)
     VALUES (?, ?, ?, ?)`
	)
		.bind(member.groupId, member.userId, member.role, member.joinedAt)
		.run();
}

export async function deleteGroupMember(db: D1Database, groupId: string, userId: string): Promise<boolean> {
	const result = await db.prepare(
		`DELETE FROM group_members
     WHERE groupId = ? AND userId = ?`
	)
		.bind(groupId, userId)
		.run();

	return (result.meta.changes ?? 0) > 0;
}

export async function updateGroupMemberRole(db: D1Database, groupId: string, userId: string, role: GroupRole): Promise<boolean> {
	const result = await db.prepare(
		`UPDATE group_members
     SET role = ?
     WHERE groupId = ? AND userId = ?`
	)
		.bind(role, groupId, userId)
		.run();

	return (result.meta.changes ?? 0) > 0;
}

export async function countGroupOwners(db: D1Database, groupId: string): Promise<number> {
	const row = await db.prepare(`SELECT COUNT(*) AS total FROM group_members WHERE groupId = ? AND role = 'owner'`)
		.bind(groupId).first<{ total: number }>();

	return row?.total ?? 0;
}

export async function countGroups(db: D1Database, userId: string): Promise<number> {
	const row = await db.prepare(`SELECT COUNT(*) AS total FROM groups WHERE ownerId = ?`).bind(userId).first<{ total: number }>();
	return row?.total ?? 0;
}
