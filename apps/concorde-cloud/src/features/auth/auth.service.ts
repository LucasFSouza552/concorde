import { Credentials, isValidEmail, isValidUsernameFormat, LoginResponse, RegisterData, sanitizeUsername, User } from "@concorde/shared";
import { createUser, getUserByEmail, getUserById } from "./auth.repository";
import { CreateUserData } from "./auth.type";

import { AppError } from "../../utils/AppError";
import { hashPassword, verifyPassword } from "../../utils/auth.password";
import { createToken } from "../../utils/JWT";

import { getUserRecordById, updateDisplayName, updateUserPassword } from "./auth.repository";

const MAX_DISPLAY_NAME_LENGTH = 32;
const MAX_PASSWORD_LENGTH = 128;

export async function registerUser(db: D1Database, secret: string, data: RegisterData): Promise<LoginResponse> {

	const { email, password } = data;
	const username = sanitizeUsername(data.username);

	if (!isValidUsernameFormat(username)) {
		throw AppError.badRequest("Use letras minúsculas, números, ponto e underline.");
	}

	if (!isValidEmail(email)) {
		throw AppError.badRequest("O email é inválido");
	}

	const existingUser = await getUserByEmail(db, email);

	if (existingUser) {
		throw AppError.conflict("O email já possui uma conta.");
	}

	const { hash, salt } = await hashPassword(password);

	const userData: CreateUserData = {
		username: username,
		email: email,
		passwordHash: hash,
		passwordSalt: salt
	};

	const user = await createUser(db, userData);
	const token = await createToken(user.id, secret);

	return { user, token };
}

export async function loginUser(db: D1Database, secret: string, data: Credentials): Promise<LoginResponse> {
	const user = await getUserByEmail(db, data.email);

	if (!user) {
		throw AppError.conflict("Email ou senha inválidos");
	}

	const passwordValid = await verifyPassword(
		data.password,
		user.passwordHash,
		user.passwordSalt
	);

	if (!passwordValid) {
		throw AppError.conflict("Email ou senha inválidos");
	}

	const token = await createToken(
		user.id,
		secret
	);

	return {
		user: {
			id: user.id,
			username: user.username,
			displayName: user.displayName,
			email: user.email,
			friendsOnly: Boolean(user.friendsOnly),
			createdAt: user.createdAt
		},
		token
	};
}

export async function getCurrentUser(db: D1Database, id: string): Promise<User> {
	const user = await getUserById(db, id);

	if (!user) {
		throw AppError.notFound("Usuário não encontrado");
	}

	return user;
}

export async function changeDisplayName(db: D1Database, id: string, displayName: unknown): Promise<User> {
	if (typeof displayName !== "string") {
		throw AppError.badRequest("Informe um nome de exibição.");
	}

	const name = displayName.trim().slice(0, MAX_DISPLAY_NAME_LENGTH);

	if (name.length === 0) {
		throw AppError.badRequest("O nome de exibição não pode ficar vazio.");
	}

	if (name !== displayName.trim()) {
		throw AppError.badRequest(`O nome pode ter no máximo ${MAX_DISPLAY_NAME_LENGTH} caracteres.`);
	}

	await updateDisplayName(db, id, name);

	const user = await getUserById(db, id);

	if (!user) {
		throw AppError.notFound("Usuário não encontrado");
	}

	return user;
}

export async function changePassword(db: D1Database, id: string, currentPassword: unknown, newPassword: unknown): Promise<void> {
	if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
		throw AppError.badRequest("Informe a senha atual e a nova senha.");
	}

	if (!currentPassword || !newPassword) {
		throw AppError.badRequest("Informe a senha atual e a nova senha.");
	}

	if (newPassword.length < 6) {
		throw AppError.badRequest("A nova senha precisa de pelo menos 6 caracteres.");
	}

	if (newPassword.length > MAX_PASSWORD_LENGTH) {
		throw AppError.badRequest(`A senha pode ter no máximo ${MAX_PASSWORD_LENGTH} caracteres.`);
	}

	const record = await getUserRecordById(db, id);

	if (!record) {
		throw AppError.notFound("Usuário não encontrado");
	}

	const currentValid = await verifyPassword(currentPassword, record.passwordHash, record.passwordSalt);

	if (!currentValid) {
		throw AppError.badRequest("A senha atual está incorreta.");
	}

	const { hash, salt } = await hashPassword(newPassword);

	await updateUserPassword(db, id, hash, salt);
}