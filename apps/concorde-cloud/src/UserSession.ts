import { UserSocketClientMessage, UserSocketServerMessage } from "@concorde/shared";
import { Env } from "./types/Env";
import { findFriendsByStatus } from "./features/friends/friends.repository";

import { verifyToken } from "./utils/JWT";

interface SocketAttachment {
	expectedUserId: string;
	userId: string | null;
	authenticated: boolean;
	connectedAt: number;
	callGroupId: string | null;
	callConcordeGroupId: string | null;
}

export class UserSession {
	constructor(private ctx: DurableObjectState, private env: Env) { }

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname.endsWith("/deliver") && request.method === "POST") {
			return this.deliver(await request.json());
		}

		if (url.pathname.endsWith("/presence")) {
			return Response.json(this.presence());
		}

		if (request.headers.get("Upgrade") !== "websocket") {
			return new Response("Esperando WebSocket", { status: 426 });
		}

		const pair = new WebSocketPair();
		const client = pair[0];
		const server = pair[1];
		const parts = url.pathname.split("/").filter(Boolean);
		const expectedUserId = parts[parts.length - 2] ?? ""

		server.serializeAttachment({
			expectedUserId: expectedUserId,
			userId: null,
			authenticated: false,
			connectedAt: Date.now(),
			callGroupId: null,
			callConcordeGroupId: null
		} satisfies SocketAttachment);

		this.ctx.acceptWebSocket(server);
		await this.ctx.storage.setAlarm(Date.now() + 10_000);

		return new Response(null, { status: 101, webSocket: client });
	}

	async webSocketMessage(socket: WebSocket, message: string) {
		let parsed: UserSocketClientMessage;

		try {
			parsed = JSON.parse(message);
		} catch {
			socket.close(4400, "Mensagem inválida.");
			return;
		}

		const attachment = socket.deserializeAttachment() as SocketAttachment;

		if (parsed.type === "ping") {
			socket.send(JSON.stringify({ type: "pong" } satisfies UserSocketServerMessage));
			return;
		}

		if (!attachment.authenticated) {
			if (parsed.type !== "auth") {
				socket.close(4401, "Autenticação necessária.");
				return;
			}

			try {
				const userId = await verifyToken(parsed.token, this.env.JWT_SECRET);

				if (userId !== attachment.expectedUserId) {
					socket.close(4403, "Usuário inválido.");
					return;
				}

				socket.serializeAttachment({
					...attachment,
					userId,
					authenticated: true
				});

			socket.send(JSON.stringify({
				type: "user-connected",
				userId
			} satisfies UserSocketServerMessage));
		} catch {
			socket.close(4401, "Token inválido.");
		}

		return;
	}

	if (parsed.type !== "call-state") {
		return;
	}

	const previousGroupId = attachment.callGroupId;
	const concordeGroupId = parsed.concordeGroupId ?? null;

	socket.serializeAttachment({
		...attachment,
		callGroupId: parsed.groupId,
		callConcordeGroupId: concordeGroupId
	});

	if ((previousGroupId !== parsed.groupId || attachment.callConcordeGroupId !== concordeGroupId) && attachment.userId) {
		await this.notifyCallState(attachment.userId, parsed.groupId, concordeGroupId);
	}
	}

	private presence(): { online: boolean; inCall: boolean; groupId: string | null; concordeGroupId: string | null } {
		let groupId: string | null = null;
		let concordeGroupId: string | null = null;

		for (const socket of this.ctx.getWebSockets()) {
			const attachment = socket.deserializeAttachment() as SocketAttachment;

			if (!attachment.authenticated) continue;

			if (attachment.callGroupId) {
				groupId = attachment.callGroupId;
				concordeGroupId = attachment.callConcordeGroupId;
				break;
			}
		}

		return { online: this.isOnline(), inCall: groupId !== null, groupId, concordeGroupId };
	}

	private async notifyCallState(userId: string, groupId: string | null, concordeGroupId: string | null): Promise<void> {
		let friends = [];

		try {
			friends = await findFriendsByStatus(this.env.concorde_users, userId, "accepted");
		} catch {
			return;
		}

		const message = JSON.stringify({
			type: "peer-call-state",
			userId,
			groupId,
			concordeGroupId
		} satisfies UserSocketServerMessage);

		for (const friend of friends) {
			try {
				const stub = this.env.USER_SESSIONS.get(this.env.USER_SESSIONS.idFromName(friend.id));
				await stub.fetch("https://user-session/deliver", {
					method: "POST",
					body: message
				});
			} catch {

			}
		}
	}

	async webSocketClose(socket: WebSocket) {
		const attachment = socket.deserializeAttachment() as SocketAttachment;

		socket.serializeAttachment({
			...attachment,
			callGroupId: null,
			callConcordeGroupId: null
		});
	}

	async alarm() {
		for (const socket of this.ctx.getWebSockets()) {
			const attachment = socket.deserializeAttachment() as SocketAttachment;

			if (!attachment.authenticated) {
				socket.close(4401, "Autenticação necessária.");
			}
		}
	}

	private isOnline(): boolean {
		return this.ctx.getWebSockets().some((socket) => {
			const attachment = socket.deserializeAttachment() as SocketAttachment;
			return attachment.authenticated;
		});
	}

	private async deliver(message: UserSocketServerMessage): Promise<Response> {
		for (const socket of this.ctx.getWebSockets()) {
			const attachment = socket.deserializeAttachment() as SocketAttachment;

			if (attachment.authenticated) {
				socket.send(JSON.stringify(message));
			}
		}

		return Response.json({ delivered: true });
	}
}
