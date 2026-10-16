import { Credentials, isValidEmail, isValidUsernameFormat, LoginResponse, RegisterData, sanitizeUsername, User } from "@concorde/shared";
import { createUser, getUserByEmail, getUserById } from "./auth.repository";
import { CreateUserData } from "./auth.type";

import { AppError } from "../../utils/AppError";
import { hashPassword, verifyPassword } from "../../utils/auth.password";
import { createToken } from "../../utils/JWT";

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