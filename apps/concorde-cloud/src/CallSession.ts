import type { ClientMessage, DirectClientMessage, Peer, ServerMessage } from "@concorde/shared";

export class CallSession {
	private clients = new Map<WebSocket, Peer>();
	private state = new Map<string, { sharing: boolean; muted: boolean; deafened: boolean }>();

	async fetch(request: Request): Promise<Response> {
		const upgradeHeader = request.headers.get("Upgrade");

		if (upgradeHeader !== "websocket") {
			return new Response("Esperando uma conexão WebSocket.", {
				status: 426,
			});
		}

		const webSocketPair = new WebSocketPair();

		const client = webSocketPair[0];
		const server = webSocketPair[1];

		server.accept();

		this.clients.set(server, { userId: "", username: "" });

		server.addEventListener("message", (event) => {
			const message: ClientMessage = JSON.parse(event.data);

			if ("to" in message) {
				this.forward(server, message);
				return;
			}

			switch (message.type) {
				case "join": {
					const previous = [...this.clients.entries()].find(
						([, peer]) => peer.userId === message.userId
					);
					const staleSocket = previous?.[0];

					if (staleSocket) {
						this.clients.delete(staleSocket);

						this.broadcast(server, { type: "peer-left", userId: message.userId });
					}

					const peer: Peer = {
						userId: message.userId,
						username: message.username,
					};

					this.state.delete(message.userId);

					server.send(
						JSON.stringify({
							type: "peers",
							peers: this.getPeers(),
						} satisfies ServerMessage)
					);

					for (const [userId, current] of this.state) {
						if (userId === message.userId || !userId) continue;

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

					this.broadcast(server, { type: "peer-joined", peer });

					this.clients.set(server, peer);

					staleSocket?.close();
					break;
				}
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

			if (peer?.userId) {
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

	private getPeers(): Peer[] {
		return [...this.clients.values()].filter((peer) => peer.userId !== "");
	}

	private broadcast(sender: WebSocket, message: ServerMessage) {
		for (const client of this.clients.keys()) {
			if (client === sender) continue;

			try {
				client.send(JSON.stringify(message));
			} catch (error) {
				console.log("Falha no broadcast: ", error);
			}
		}
	}

	private forward(server: WebSocket, message: DirectClientMessage): void {
		const from = this.clients.get(server)?.userId ?? "";
		const target = this.findClient(message.to);

		if (!target) {
			console.log(`Destino ${message.to} não encontrado.`);
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