import { Env } from "../../types/Env";

export interface CallRoom {
	groupId: string;
	kind: "dm" | "group";
	concordeGroupId: string | null;
	createdAt: number;
	expiresAt: number;
}

/**
 * Ciclo de vida da chamada na hora da criação do convite: convites
 * expiram em 30 s, mas a chamada em si (peer cam etc.) pode seguir viva.
 * A sala só é removida quando inativa por jornada sem peer novo entry.
 */
export const CALL_ROOM_TTL_MS = 2 * 60 * 60_000;

interface RoomRow {
	groupId: string;
	kind: "dm" | "group";
	concordeGroupId: string | null;
	createdAt: number;
	expiresAt: number;
}

function toRoom(row: { groupId: string; kind: "dm" | "group"; concordeGroupId: string | null; createdAt: number; expiresAt: number }): CallRoom {
	return { groupId: row.groupId, kind: row.kind, concordeGroupId: row.concordeGroupId, createdAt: row.createdAt, expiresAt: row.expiresAt };
}

export async function createCallRoom(
	db: D1Database,
	room: { groupId: string; kind: "dm" | "group"; concordeGroupId?: string | null; participants: string[]; now: number }
): Promise<void> {
	const expiresAt = room.now + CALL_ROOM_TTL_MS;
	const stmts: D1PreparedStatement[] = [
		// Piggyback: a criação é a escrita por chamada — remove salas
		// sobressalentes (ex.: chamadas que nunca conectaram) na mesma batch.
		...purgeExpiredRoomStatements(db, room.now),
		db.prepare(
			`INSERT INTO call_rooms (groupId, kind, concordeGroupId, createdAt, expiresAt) VALUES (?, ?, ?, ?, ?)
			ON CONFLICT(groupId) DO UPDATE SET kind = excluded.kind, concordeGroupId = excluded.concordeGroupId, expiresAt = excluded.expiresAt`
		).bind(room.groupId, room.kind, room.concordeGroupId ?? null, room.now, expiresAt),
		// Participantes são reescritos (nova chamada viva na mesma sala de grupo).
		db.prepare("DELETE FROM call_room_participants WHERE groupId = ?").bind(room.groupId),
	];
	for (let i = 0; i < room.participants.length; i += 1) {
		stmts.push(
			db.prepare(
				"INSERT INTO call_room_participants (groupId, userId, joinedAt) VALUES (?, ?, ?)"
			).bind(room.groupId, room.participants[i], room.now)
		);
	}
	await db.batch(stmts);
}

export async function getCallRoom(db: D1Database, groupId: string): Promise<CallRoom | null> {
	const { results } = await db.prepare(
		"SELECT groupId, kind, concordeGroupId, createdAt, expiresAt FROM call_rooms WHERE groupId = ?"
	).bind(groupId).all<RoomRow>();

	const row = results[0];
	return row ? toRoom(row) : null;
}

export async function isCallRoomParticipant(db: D1Database, groupId: string, userId: string): Promise<boolean> {
	const { results } = await db.prepare(
		"SELECT userId FROM call_room_participants WHERE groupId = ? AND userId = ?"
	).bind(groupId, userId).all<{ userId: string }>();
	return results.length > 0;
}

export async function listCallRoomParticipants(db: D1Database, groupId: string): Promise<Set<string>> {
	const { results } = await db.prepare(
		"SELECT userId FROM call_room_participants WHERE groupId = ?"
	).bind(groupId).all<{ userId: string }>();

	return new Set(results.map((row) => row.userId));
}

/** Renova a janela de vida da sala (participantes reconnectam a call). */
export async function touchCallRoom(db: D1Database, groupId: string, now: number): Promise<void> {
	await db.prepare("UPDATE call_rooms SET expiresAt = ? WHERE groupId = ?").bind(now + CALL_ROOM_TTL_MS, groupId).run();
}

export async function deleteCallRoom(db: D1Database, groupId: string): Promise<void> {
	await db.batch([
		db.prepare("DELETE FROM call_room_participants WHERE groupId = ?").bind(groupId),
		db.prepare("DELETE FROM call_rooms WHERE groupId = ?").bind(groupId),
	]);
}

/** Housekeeping: remove salas cuja janela expirou (chamadas que nunca conectaram). */
export async function purgeExpiredCallRooms(db: D1Database, now: number): Promise<void> {
	await db.batch(purgeExpiredRoomStatements(db, now));
}

function purgeExpiredRoomStatements(db: D1Database, now: number): D1PreparedStatement[] {
	return [
		db.prepare(
			"DELETE FROM call_room_participants WHERE groupId IN (SELECT groupId FROM call_rooms WHERE expiresAt < ?)"
		).bind(now),
		db.prepare("DELETE FROM call_rooms WHERE expiresAt < ?").bind(now)
	];
}
