import { Friend, Friendship, FriendshipStatus, SendFriendRequestResult } from "@concorde/shared";

export async function findUserByUsername(db: D1Database, username: string): Promise<Friend | null> {
	return db.prepare(`SELECT id, username, displayName FROM users WHERE username = ? COLLATE NOCASE`)
		.bind(username)
		.first<Friend>();
}

export async function getFriendship(db: D1Database, userId: string, friendId: string): Promise<Friendship | null> {
	return db.prepare(
		`SELECT userId, friendId, status, createdAt FROM friendships WHERE userId = ? AND friendId = ?`
	).bind(userId, friendId)
		.first<Friendship>();
}

export async function findFriendship(
	db: D1Database,
	userId: string,
	friendId: string
): Promise<Friendship | null> {
	return db.prepare(`
        SELECT userId, friendId, status, createdAt
        FROM friendships
        WHERE status = 'accepted'
          AND (
              (userId = ? AND friendId = ?)
              OR
              (userId = ? AND friendId = ?)
          )
        LIMIT 1
    `).bind(
		userId, friendId,
		friendId, userId
	).first<Friendship>();
}

export async function sendRequest(db: D1Database, userId: string, friendId: string): Promise<void> {
	await db.prepare(`INSERT INTO friendships (userId, friendId, status, createdAt) VALUES (?, ?, 'pending', ?)`)
		.bind(userId, friendId, Date.now())
		.run();
}

export async function acceptRequest(db: D1Database, userId: string, friendId: string): Promise<boolean> {
	const request = await getFriendship(db, friendId, userId);

	if (!request || request.status !== "pending") return false;

	const now = Date.now();

	await db.batch([
		db.prepare(`UPDATE friendships SET status = 'accepted' WHERE userId = ? AND friendId = ?`)
			.bind(userId, friendId),
		db.prepare(`UPDATE friendships SET status = 'accepted' WHERE userId = ? AND friendId = ?`)
			.bind(friendId, userId),
		db.prepare(`INSERT INTO friendships (userId, friendId, status, createdAt) VALUES (?, ?, 'accepted', ?) ON CONFLICT(userId, friendId) DO NOTHING`)
			.bind(userId, friendId, now)
	])

	return true;
}

export async function declineRequest(db: D1Database, userId: string, friendId: string): Promise<boolean> {
	const request = await getFriendship(db, friendId, userId);

	if (!request || request.status !== "pending") return false;

	await db
		.prepare(`DELETE FROM friendships WHERE userId = ? AND friendId = ?`)
		.bind(friendId, userId)
		.run();

	return true;
}

export async function removeFriend(db: D1Database, userId: string, friendId: string): Promise<boolean> {
	const result = await db
		.prepare(
			`DELETE FROM friendships
			 WHERE (userId = ? AND friendId = ?) OR (userId = ? AND friendId = ?)`
		)
		.bind(userId, friendId, friendId, userId)
		.run();

	return (result.meta.changes ?? 0) > 0;
}

export async function findFriendsByStatus(db: D1Database, userId: string, status: FriendshipStatus): Promise<Friend[]> {
	const { results } = await db
		.prepare(`SELECT u.id, u.username, u.displayName FROM friendships f JOIN users u ON u.id = f.friendId WHERE f.userId = ? AND f.status = ? ORDER BY u.displayName`)
		.bind(userId, status)
		.all<Friend>();

	return results ?? [];
}

export async function findIncomingRequests(db: D1Database, userId: string): Promise<Friend[]> {
	const { results } = await db
		.prepare(`SELECT u.id, u.username, u.displayName
			FROM friendships f
			JOIN users u ON u.id = f.userId
			WHERE f.friendId = ? AND f.status = 'pending'
			ORDER BY f.createdAt DESC`)
		.bind(userId)
		.all<Friend>();

	return results ?? [];
}
