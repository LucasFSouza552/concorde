import { findFriendship, findFriendsByStatus } from "./features/friends/friends.repository";
import { findGroupAudienceForUser, hasSharedGroup } from "./features/groups/groups.repository";
import { UserSocketClientMessage, UserSocketServerMessage, type UserStatus } from "@concorde/shared";
import { Env } from "./types/Env";

import { verifyToken } from "./utils/JWT";

interface SocketAttachment {
	expectedUserId: string;
	userId: string | null;
	status: UserStatus;
	customMessage: string | null;
	authenticated: boolean;
	connectedAt: number;
	callGroupId: string | null;
	callConcordeGroupId: string | null
}

interface PresenceProps {
	status: UserStatus;
	online: boolean;
	inCall: boolean;
	groupId: string | null;
	concordeGroupId: string | null;
	customMessage?: string | null;
}

export class UserSession {
	constructor(private ctx: DurableObjectState, private env: Env) { }

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname.endsWith("/deliver") && request.method === "POST") {
			return this.deliver(await request.json());
		}

		if (url.pathname.endsWith("/presence")) {
			// Identidade do consultante: exclusivamente o header verificado
			// pelo gateway (x-verified-user). Chamada direta ao DO → 401.
			const callerId = request.headers.get("x-verified-user");

			if (!callerId) {
				return Response.json({ message: "Token de acesso não foi enviado." }, { status: 401 });
			}

			const targetId = url.pathname.split("/").filter(Boolean)[1] ?? "";

			return Response.json(await this.presence(callerId, targetId));
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
			status: "online",
			customMessage: null,
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

				const hadOtherSession = this.ctx.getWebSockets().some((other) => {
					if (other === socket) return false;
					const otherAttachment = other.deserializeAttachment() as SocketAttachment;
					return otherAttachment.authenticated;
				});

			socket.serializeAttachment({
				...attachment,
				userId,
				// Mensagem personalizada sobrevive a reconexões (persistida no DO).
				customMessage: (await this.ctx.storage.get<string>("customMessage")) ?? null,
				authenticated: true
			});

				socket.send(JSON.stringify({
					type: "user-connected",
					userId
				} satisfies UserSocketServerMessage));

				if (!hadOtherSession) {
					await this.notifyStatus(userId, "online");
				}
			} catch {
				socket.close(4401, "Token inválido.");
			}

			return;
		}

		if (parsed.type === "set-status") {
			const allowed = ["online", "away", "busy", "invisible"];

			if (!attachment.userId || !allowed.includes(parsed.status)) {
				socket.close(4402, "Status inválido.");
				return;
			}

			// Mensagem personalizada: normaliza (trim + limite) e persiste no DO
			// para sobreviver a reconexões. Ausência do campo mantém a atual.
			let customMessage = attachment.customMessage;

			if ("customMessage" in parsed) {
				customMessage = parsed.customMessage?.trim().slice(0, 80) ?? null;

				if (customMessage) {
					await this.ctx.storage.put("customMessage", customMessage);
				} else {
					await this.ctx.storage.delete("customMessage");
				}
			}

			socket.serializeAttachment({
				...attachment,
				status: parsed.status,
				customMessage
			});

			await this.notifyStatus(attachment.userId, parsed.status, customMessage);
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

	private async notifyAudience(userId: string, message: UserSocketServerMessage): Promise<void> {
		let audience: { id: string }[] = [];

		try {
			const [friends, coMembers] = await Promise.all([
				findFriendsByStatus(this.env.concorde_users, userId, "accepted"),
				findGroupAudienceForUser(this.env.concorde_users, userId)
			]);

			const seen = new Set<string>([userId]);
			audience = [...friends, ...coMembers].filter((person) => {
				if (seen.has(person.id)) return false;
				seen.add(person.id);
				return true;
			});
		} catch {
			return;
		}

		const body = JSON.stringify(message);

		for (const person of audience) {
			try {
				const stub = this.env.USER_SESSIONS.get(this.env.USER_SESSIONS.idFromName(person.id));
				await stub.fetch("https://user-session/deliver", {
					method: "POST",
					body
				});
			} catch {
			}
		}
	}

	private async notifyStatus(userId: string, status: UserStatus, customMessage?: string | null): Promise<void> {
		await this.notifyAudience(userId, {
			type: "peer-status",
			userId,
			status,
			customMessage: customMessage ?? undefined
		});
	}

	/**
	 * Chamador (callerId) sempre do token verificado; alvo da rota (targetId).
	 * Consultante sem permissão recebe presença genérica objeto-offline
	 * (mesma forma, sempre igual) para não servir de enumerador —
	 * diferente de 401, que é só para falha de autenticação.
	 */
	private async presence(callerId: string, targetId: string): Promise<PresenceProps> {
		// Sem permissão → forma estática, independente do estado real.
		if (callerId !== targetId && !(await this.isVisibleTo(callerId, targetId))) {
			return {
				status: "offline",
				online: false,
				inCall: false,
				groupId: null,
				concordeGroupId: null
			};
		}

		let groupId: string | null = null;
		let concordeGroupId: string | null = null;
		let status: UserStatus = "online";
		let customMessage: string | null = null;

		for (const socket of this.ctx.getWebSockets()) {
			const attachment = socket.deserializeAttachment() as SocketAttachment;

			if (!attachment.authenticated) continue;

			status = attachment.status;
			customMessage = attachment.customMessage;

			if (attachment.callGroupId) {
				groupId = attachment.callGroupId;
				concordeGroupId = attachment.callConcordeGroupId;
				break;
			}
		}

		const online = this.isOnline();

		if (!online) {
			customMessage = (await this.ctx.storage.get<string>("customMessage")) ?? null;
		} else if (!customMessage) {
			customMessage = (await this.ctx.storage.get<string>("customMessage")) ?? null;
		}

		return {
			status: online ? (status === "invisible" ? "offline" : status) : "offline",
			online,
			inCall: groupId !== null,
			groupId,
			concordeGroupId,
			customMessage
		};

	}

	private async isVisibleTo(callerId: string, targetId: string): Promise<boolean> {
		try {
			const [friendship, sharedGroup] = await Promise.all([
				findFriendship(this.env.concorde_users, callerId, targetId),
				hasSharedGroup(this.env.concorde_users, callerId, targetId)
			]);

			return !!friendship || sharedGroup;
		} catch {
			return false;
		}
	}

	private async notifyCallState(userId: string, groupId: string | null, concordeGroupId: string | null): Promise<void> {
		await this.notifyAudience(userId, {
			type: "peer-call-state",
			userId,
			groupId,
			concordeGroupId
		});
	}

	async webSocketClose(socket: WebSocket) {
		const attachment = socket.deserializeAttachment() as SocketAttachment;

		socket.serializeAttachment({
			...attachment,
			callGroupId: null,
			callConcordeGroupId: null
		});

		if (!attachment.authenticated || !attachment.userId) return;

		const stillOnline = this.ctx.getWebSockets().some((other) => {
			if (other === socket) return false;
			const otherAttachment = other.deserializeAttachment() as SocketAttachment;
			return otherAttachment.authenticated;
		});

		if (stillOnline) return;

		await this.notifyStatus(attachment.userId, "offline");
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