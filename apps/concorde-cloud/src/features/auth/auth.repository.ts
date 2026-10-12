import { RegisterData, User } from "@concorde/shared";
import { CreateUserData, UserRecord } from "./auth.type";

export async function createUser(db: D1Database, data: CreateUserData) {
	const id = crypto.randomUUID();
	const createdAt = Date.now();

	await db
		.prepare(`
			INSERT INTO users (
				id,
				username,
				displayName,
				email,
				passwordHash,
				passwordSalt,
				createdAt
			)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`)
		.bind(
			id,
			data.username,
			data.username,
			data.email,
			data.passwordHash,
			data.passwordSalt,
			createdAt
		)
		.run();

	return {
		id,
		username: data.username,
		displayName: data.username,
		email: data.email,
		createdAt
	};
}

export async function getUserByEmail(db: D1Database, email: string): Promise<UserRecord | null> {
	const user = await db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first<UserRecord>();
	return user;
}

export async function getUserById(db: D1Database, id: string): Promise<User | null> {
	const user = await db.prepare(`SELECT id, username, displayName, email, createdAt FROM users WHERE id = ?`).bind(id).first<User>();

	return user;
}