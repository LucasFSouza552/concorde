import type { ClientMessage, DirectClientMessage, Peer, ServerMessage } from "@concorde/shared";

import { Env } from "./types/Env";
import { getUserById } from "./features/auth/auth.repository";

interface CallPeer extends Peer {
	/** true somente depois do join com identidade verificada. */
	joined: boolean;
}

export class CallSession {
	private clients = new Map<WebSocket, CallPeer>();
	private state = new Map<string, { sharing: boolean; muted: boolean; deafened: boolean }>();

	// Assinatura do DO é (state, env): antes eu só recebia o primeiro,
	// então `env` eram na verdade o DurableObjectState e o acesso a
	// binding (concorde_users) quebrava silenciosamente no join.
	constructor(ctx: DurableObjectState, private env: Env) { }

	async fetch(request: Request): Promise<Response> {
		const upgradeHeader = request.headers.get("Upgrade");

		if (upgradeHeader !== "websocket") {
			return new Response("Esperando uma conexão WebSocket.", {
				status: 426,
			});
		}

		// Defesa em profundidade: o gateway autentica e injeta x-verified-user.
		// Um upgrade que burlar o caminho autenticado nunca recebe identidade.
		const verifiedUserId = request.headers.get("x-verified-user");

		if (!verifiedUserId) {
			return new Response("Autenticação necessária.", {
				status: 401,
			});
		}

		const webSocketPair = new WebSocketPair();

		const client = webSocketPair[0];
		const server = webSocketPair[1];

		server.accept();

		this.clients.set(server, { userId: verifiedUserId, username: "", joined: false });

		server.addEventListener("message", (event) => {
			let message: ClientMessage;

			try {
				message = JSON.parse(event.data) as ClientMessage;
			} catch {
				server.close(4400, "Mensagem inválida.");
				return;
			}

			if ("to" in message) {
				this.forward(server, message);
				return;
			}

			if (message.type === "join") {
				void this.handleJoin(server, message);
				return;
			}

			switch (message.type) {
				case "chat":
					this.broadcast(server, message);
					break;
				case "mute-state": {
					const from = this.clients.get(server)?.userId ?? "";
					this.state.set(from, {
						...(this.state.get(from) ?? { sharing: false, muted: false, deafened: false }),
						muted: message.muted,
						deafened: message.deafened
					});
					this.broadcast(server, {
						type: "mute-state",
						muted: message.muted,
						deafened: message.deafened,
						from
					});

					break;
				}
				case "screen-share":
					const from = this.clients.get(server)?.userId ?? "";
					this.state.set(from, {
						...(this.state.get(from) ?? { sharing: false, muted: false, deafened: false }),
						sharing: message.sharing
					});
					this.broadcast(server, { type: "screen-share", sharing: message.sharing, from });
					break;
			}

		});

		server.addEventListener("close", () => {
			const peer = this.clients.get(server);

			this.clients.delete(server);

			// Sockets que nunca chegaram a entrar não participam do roster.
			if (peer?.joined) {
				if (!this.findClient(peer.userId)) {
					this.state.delete(peer.userId);
				}

				this.broadcast(server, { type: "peer-left", userId: peer.userId });
			}

		});

		server.send(
			JSON.stringify({
				type: "connected",
			})
		);

		return new Response(null, {
			status: 101,
			webSocket: client,
		});
	}

	private async handleJoin(server: WebSocket, message: ClientMessage & { type: "join" }): Promise<void> {
		const peer = this.clients.get(server);

		if (!peer) {
			server.close(4403, "Usuário inválido.");
			return;
		}

		// A identidade da call é sempre a verificada no handshake. Qualquer
		// divergência — inclusive reassumir outro userId — fecha o socket
		// antes de aceitar o participante.
		if (message.userId && message.userId !== peer.userId) {
			server.close(4403, "Usuário inválido.");
			return;
		}

		const user = await getUserById(this.env.concorde_users, peer.userId);

		if (!user) {
			this.clients.delete(server);
			server.close(4403, "Usuário inválido.");
			return;
		}

		const verified: CallPeer = {
			userId: peer.userId,
			username: user.displayName,
			joined: true,
		};

		const previous = [...this.clients.entries()].find(
			([candidate, entry]) => candidate !== server && entry.joined && entry.userId === verified.userId
		);
		const staleSocket = previous?.[0];

		if (staleSocket) {
			this.clients.delete(staleSocket);

			this.broadcast(server, { type: "peer-left", userId: verified.userId });
		}

		this.state.delete(verified.userId);

		server.send(
			JSON.stringify({
				type: "peers",
				peers: this.getPeers(),
			} satisfies ServerMessage)
		);

		for (const [userId, current] of this.state) {
			if (userId === verified.userId || !userId) continue;

			if (current.sharing) {
				server.send(
					JSON.stringify({
						type: "screen-share",
						sharing: true,
						from: userId,
					} satisfies ServerMessage)
				);
			}

			if (current.muted || current.deafened) {
				server.send(
					JSON.stringify({
						type: "mute-state",
						muted: current.muted,
						deafened: current.deafened,
						from: userId,
					} satisfies ServerMessage)
				);
			}
		}

		this.broadcast(server, { type: "peer-joined", peer: { userId: verified.userId, username: verified.username } });

		this.clients.set(server, verified);

		staleSocket?.close();
	}

	private getPeers(): Peer[] {
		return [...this.clients.values()]
			.filter((peer) => peer.joined)
			.map(({ userId, username }) => ({ userId, username }));
	}

	private broadcast(sender: WebSocket, message: ServerMessage) {
		for (const client of this.clients.keys()) {
			if (client === sender) continue;

			try {
				client.send(JSON.stringify(message));
			} catch (error) {
				console.error("Falha no broadcast da call:", error);
			}
		}
	}

	private forward(server: WebSocket, message: DirectClientMessage): void {
		const from = this.clients.get(server)?.userId ?? "";
		const target = this.findClient(message.to);

		if (!target) {
			return;
		}

		target.send(JSON.stringify({ ...message, from } satisfies ServerMessage));
	}

	private findClient(userId: string): WebSocket | undefined {
		for (const [client, peer] of this.clients) {
			if (peer.userId === userId) {
				return client;
			}
		}

		return undefined;
	}
}
