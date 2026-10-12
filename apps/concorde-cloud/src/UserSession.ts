import { UserSocketClientMessage, UserSocketServerMessage } from "@concorde/shared";
import { Env } from "./types/Env";

import { verifyToken } from "./utils/JWT";

interface SocketAttachment {
	expectedUserId: string;
	userId: string | null;
	authenticated: boolean;
	connectedAt: number;
}

export class UserSession {
	constructor(private ctx: DurableObjectState, private env: Env) { }

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname.endsWith("/deliver") && request.method === "POST") {
			return this.deliver(await request.json());
		}

		if (url.pathname.endsWith("/presence")) {
			return Response.json({ online: this.isOnline() });
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
			connectedAt: Date.now()
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
