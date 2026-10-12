import type { Context, Next } from "hono";

import { Env } from "../types/Env";

import { AppError } from "../utils/AppError";
import { verifyToken } from "../utils/JWT";

export async function authMiddleware(c: Context<{ Bindings: Env; Variables: { userId: string }; }>, next: Next) {
	const authorization = c.req.header("Authorization");

	if (!authorization) {
		throw AppError.unauthorized("Token de acesso não foi enviado.")
	}

	const [scheme, token] = authorization.split(" ");

	if (scheme !== "Bearer" || !token) {
		throw AppError.unauthorized("Formato de token inválido.");
	}

	let userId: string;

	try {
		userId = await verifyToken(token, c.env.JWT_SECRET);
	} catch (error) {
		throw AppError.unauthorized("Token inválido ou expirado");
	}

	c.set("userId", userId);

	await next();
};