import { Context } from "hono";

import { getCurrentUser, loginUser, registerUser } from "./auth.service";
import { Env } from "../../types/Env";

export async function registerController(c: Context) {

	const data = await c.req.json();

	const user = await registerUser(c.env.concorde_users, c.env.JWT_SECRET, data);

	return c.json(user, 201);
}

export async function loginController(c: Context) {
	const data = await c.req.json();
	const user = await loginUser(c.env.concorde_users, c.env.JWT_SECRET, data);
	console.log(user);
	return c.json(user);

}

export async function meController(c: Context<{ Bindings: Env; Variables: { userId: string } }>) {
	const user = await getCurrentUser(c.env.concorde_users, c.get("userId"));

	return c.json(user);
}