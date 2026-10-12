import { NewChannel, NewMessage } from "@concorde/shared";

export interface ChannelUserRecord {
	channelId: string;
	userId: string;
	joinedAt: number;
}
export interface ChannelMember {
	id: string;
	username: string;
	displayName: string;
}

export async function findDMchannel(db: D1Database, dmKey: string) {
	return db.prepare(`SELECT * FROM channels WHERE dmKey = ?`).bind(dmKey).first<NewChannel>();
}

export async function findChannelUser(db: D1Database, channelId: string, userId: string): Promise<ChannelUserRecord | null> {
	return db.prepare(`SELECT channelId, userId, joinedAt FROM channel_users WHERE channelId = ? AND userId = ?`)
		.bind(channelId, userId)
		.first<ChannelUserRecord>();
}

export async function findChannelById(db: D1Database, channelId: string): Promise<NewChannel | null> {
	return db.prepare(`SELECT id, groupId, kind, name, dmKey, createdAt FROM channels WHERE id = ? `)
		.bind(channelId)
		.first<NewChannel>();
}

export async function findOtherChannelUser(db: D1Database, channelId: string, userId: string) {
	return db.prepare(`SELECT userId FROM channel_users WHERE channelId = ? AND userId != ?`)
		.bind(channelId, userId)
		.first<{ userId: string }>();
}

export async function createChannel(db: D1Database, channel: NewChannel) {
	await db.prepare(`INSERT INTO channels (
		id,
		groupId,
		kind,
		name,
		dmKey,
		createdAt
	) VALUES (?, ?, ?, ?, ?, ?)`)
		.bind(channel.id, channel.groupId, channel.kind, channel.name, channel.dmKey, channel.createdAt)
		.run();
}

export async function addChannelUser(db: D1Database, channelId: string, userId: string, joinedAt: number) {
	await db.prepare(`INSERT INTO channel_users (
			channelId,
			userId,
			joinedAt
		) VALUES (?, ?, ?)`)
		.bind(channelId, userId, joinedAt).run();
}

export async function listUserChannels(db: D1Database, userId: string) {
	const { results } = await db.prepare(
		`SELECT
       c.id, c.groupId, c.kind, c.name, c.createdAt
     FROM channel_users uc
     JOIN channels c ON c.id = uc.channelId
     WHERE uc.userId = ?
     UNION
     SELECT
       c.id, c.groupId, c.kind, c.name, c.createdAt
     FROM group_members gm
     JOIN channels c ON c.groupId = gm.groupId
     WHERE gm.userId = ? AND c.kind = 'group'
     ORDER BY createdAt DESC`
	)
		.bind(userId, userId)
		.all();

	return results ?? [];
}

export async function insertMessage(db: D1Database, message: NewMessage) {
	await db.prepare(`INSERT INTO messages (
		id, channelId, userId, kind, content, createdAt
		) VALUES (?, ?, ?, ?, ?, ?)`).bind(message.id, message.channelId, message.userId, message.kind, message.content, message.createdAt).run();
}

export async function listChannelMembers(db: D1Database, channelId: string): Promise<ChannelMember[]> {
	const { results } = await db.prepare(
		`SELECT u.id, u.username, u.displayName
     FROM channel_users cu
     JOIN users u ON u.id = cu.userId
     WHERE cu.channelId = ?
     ORDER BY u.displayName`
	)
		.bind(channelId)
		.all<ChannelMember>();

	return results ?? [];
}

export async function listGroupChannelMembers(db: D1Database, groupId: string) {
	const { results } = await db.prepare(
		`SELECT u.id, u.username, u.displayName
     FROM group_members gm
     JOIN users u ON u.id = gm.userId
     WHERE gm.groupId = ?
     ORDER BY u.displayName`
	)
		.bind(groupId)
		.all<ChannelMember>();

	return results ?? [];
}

export async function listChannelMessages(db: D1Database, channelId: string, limit: number) {
	const { results } = await db
		.prepare(`SELECT id, channelId, userId, kind, content, createdAt FROM messages WHERE channelId = ? ORDER BY createdAt ASC LIMIT ?`)
		.bind(channelId, limit)
		.all();

	return results ?? [];
}