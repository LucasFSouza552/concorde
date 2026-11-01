import type { ClientMessage, DirectClientMessage, Peer, ServerMessage } from '@concorde/shared';

import { Env } from './types/Env';
import { getUserById } from './features/auth/auth.repository';
import { getCallRoom, createCallRoom, isCallRoomParticipant, touchCallRoom, deleteCallRoom } from './features/calls/calls.repository';
import { findGroupMember } from './features/groups/groups.repository';

/** Margem útil entre pings de vida da sala: alarm do DO renova o TTL. */
const ROOM_RENEWAL_INTERVAL_MS = 60 * 60_000;
/** Depois que a última conexão sai, apaga o registro da sala. */
const ROOM_EMPTY_GRACE_MS = 60_000;
/** Timeout para chamadas 1:1 aguardando atendimento. */
const CALL_RING_TIMEOUT_MS = 30_000;

interface CallPeer extends Peer {
	/** true somente depois do join com identidade verificada. */
	joined: boolean;
}

type CallState = 'ringing' | 'active' | 'expired' | 'cancelled' | 'declined';

interface PersistedCallState {
	callState: CallState;
	ringStartedAt: number | null;
	decided: boolean;
}

export class CallSession {
	private clients = new Map<WebSocket, CallPeer>();
	private state = new Map<string, { sharing: boolean; muted: boolean; deafened: boolean }>();

	private roomId: string | null = null;

	private callState: CallState = 'active';
	private ringStartedAt: number | null = null;
	private decided = false;

	constructor(private ctx: DurableObjectState, private env: Env) {}

	private isGroupCall(): boolean {
		return this.roomId?.startsWith('group:') === true;
	}

	private isDmCall(): boolean {
		return !this.isGroupCall() && this.roomId !== null;
	}

	private async loadPersistedState(): Promise<void> {
		try {
			const stored = await this.ctx.storage.get<PersistedCallState>('callState');
			if (stored) {
				this.callState = stored.callState;
				this.ringStartedAt = stored.ringStartedAt;
				this.decided = stored.decided;
			}
		} catch {}
	}

	private async persistState(): Promise<void> {
		try {
			await this.ctx.storage.put<PersistedCallState>('callState', {
				callState: this.callState,
				ringStartedAt: this.ringStartedAt,
				decided: this.decided
			});
		} catch {}
	}

	private async expireRingingCall(): Promise<void> {
		if (this.decided) return;
		if (this.isGroupCall()) return;
		if (this.callState !== 'ringing') return;

		this.decided = true;
		this.callState = 'expired';
		await this.persistState();

		for (const client of this.clients.keys()) {
			try {
				client.close(4000, 'Chamada expirada');
			} catch {}
		}

		if (this.roomId) {
			try {
				await deleteCallRoom(this.env.concorde_users, this.roomId);
			} catch {}
		}

		this.clients.clear();
	}

	private async markCallActive(): Promise<void> {
		if (this.isGroupCall()) return;
		if (this.decided && this.callState !== 'ringing') return;

		this.decided = true;
		this.callState = 'active';
		this.ringStartedAt = null;
		await this.persistState();

		if (this.clients.size > 0) {
			if (this.roomId) {
				try {
					await touchCallRoom(this.env.concorde_users, this.roomId, Date.now());
				} catch {}
			}
			await this.ctx.storage.setAlarm(Date.now() + ROOM_RENEWAL_INTERVAL_MS);
		}
	}
	async fetch(request: Request): Promise<Response> {
		await this.loadPersistedState();

		const upgradeHeader = request.headers.get('Upgrade');

		if (upgradeHeader !== 'websocket') {
			return new Response('Esperando uma conexão WebSocket.', { status: 426 });
		}

		const verifiedUserId = request.headers.get('x-verified-user');

		if (!verifiedUserId) {
			return new Response('Autenticação necessária.', { status: 401 });
		}

		this.roomId = request.headers.get('x-call-room') ?? this.ctx.id.name ?? null;

		if (this.roomId && this.isDmCall() && this.callState === 'active' && this.ringStartedAt === null && !this.decided) {
			const room = await getCallRoom(this.env.concorde_users, this.roomId);
			if (room && room.kind === 'dm') {
				this.callState = 'ringing';
				this.ringStartedAt = Date.now();
				this.decided = false;
				await this.persistState();
				await this.ctx.storage.setAlarm(Date.now() + CALL_RING_TIMEOUT_MS);
			}
		}

		const webSocketPair = new WebSocketPair();
		const client = webSocketPair[0];
		const server = webSocketPair[1];

		server.accept();

		this.clients.set(server, { userId: verifiedUserId, username: '', joined: false });

		server.addEventListener('message', (event) => {
			let message: ClientMessage;

			try {
				message = JSON.parse(event.data) as ClientMessage;
			} catch {
				server.close(4400, 'Mensagem inválida.');
				return;
			}

			if ('to' in message) {
				this.forward(server, message);
				return;
			}

			if (message.type === 'join') {
				void this.handleJoin(server, message);
				return;
			}

			switch (message.type) {
				case 'chat':
					this.broadcast(server, message);
					break;
				case 'mute-state': {
					const from = this.clients.get(server)?.userId ?? '';
					this.state.set(from, {
						...(this.state.get(from) ?? { sharing: false, muted: false, deafened: false }),
						muted: message.muted,
						deafened: message.deafened
					});
					this.broadcast(server, { type: 'mute-state', muted: message.muted, deafened: message.deafened, from });
					break;
				}
				case 'screen-share': {
					const from = this.clients.get(server)?.userId ?? '';
					this.state.set(from, {
						...(this.state.get(from) ?? { sharing: false, muted: false, deafened: false }),
						sharing: message.sharing
					});
					this.broadcast(server, { type: 'screen-share', sharing: message.sharing, from });
					break;
				}
				case 'screen-watch': {
					this.broadcast(server, {
						type: 'screen-watch',
						target: message.target,
						watching: message.watching,
						from: this.clients.get(server)?.userId ?? ''
					});
					break;
				}
			}
		});

		server.addEventListener('close', () => {
			const peer = this.clients.get(server);
			this.clients.delete(server);

			if (peer?.joined) {
				if (!this.findClient(peer.userId)) {
					this.state.delete(peer.userId);
				}
				this.broadcast(server, { type: 'peer-left', userId: peer.userId });
			}

			if (this.clients.size === 0 && this.roomId) {
				void this.ctx.storage.setAlarm(Date.now() + ROOM_EMPTY_GRACE_MS);
			}
		});

		server.send(JSON.stringify({ type: 'connected' }));

		return new Response(null, { status: 101, webSocket: client });
	}
	private async handleJoin(server: WebSocket, message: ClientMessage & { type: 'join' }): Promise<void> {
		await this.loadPersistedState();

		const peer = this.clients.get(server);

		if (!peer) {
			server.close(4403, 'Usuário inválido.');
			return;
		}

		if (message.userId && message.userId !== peer.userId) {
			server.close(4403, 'Usuário inválido.');
			return;
		}

		if (this.isDmCall() && this.callState === 'ringing') {
			if (this.ringStartedAt && Date.now() >= this.ringStartedAt + CALL_RING_TIMEOUT_MS) {
				await this.expireRingingCall();
				server.close(4000, 'Chamada expirada');
				return;
			}
			if (this.decided) {
				server.close(4001, 'Chamada já finalizada');
				return;
			}
		}

		const user = await getUserById(this.env.concorde_users, peer.userId);

		if (!user) {
			this.clients.delete(server);
			server.close(4403, 'Usuário inválido.');
			return;
		}

		if (!this.roomId || !(await this.isEntranceAllowed(peer.userId))) {
			this.clients.delete(server);
			server.close(4403, 'Você não participa desta chamada.');
			return;
		}

		if (this.isDmCall() && this.callState === 'ringing' && !this.decided) {
			await this.markCallActive();
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
			this.broadcast(server, { type: 'peer-left', userId: verified.userId });
		}

		this.state.delete(verified.userId);

		server.send(JSON.stringify({ type: 'peers', peers: this.getPeers() }));

		for (const [userId, current] of this.state) {
			if (userId === verified.userId || !userId) continue;
			if (current.sharing) {
				server.send(JSON.stringify({ type: 'screen-share', sharing: true, from: userId }));
			}
			if (current.muted || current.deafened) {
				server.send(JSON.stringify({ type: 'mute-state', muted: current.muted, deafened: current.deafened, from: userId }));
			}
		}

		this.broadcast(server, { type: 'peer-joined', peer: { userId: verified.userId, username: verified.username } });

		this.clients.set(server, verified);

		if (this.isGroupCall() || this.callState === 'active') {
			await this.ctx.storage.setAlarm(Date.now() + ROOM_RENEWAL_INTERVAL_MS);
		}

		staleSocket?.close();
	}
	private async isEntranceAllowed(userId: string): Promise<boolean> {
		const db = this.env.concorde_users;
		const groupId = this.roomId as string;

		let room = await getCallRoom(db, groupId);

		if ((!room || room.expiresAt <= Date.now()) && groupId.startsWith('group:')) {
			const concordeGroupId = groupId.slice('group:'.length);
			const membership = await findGroupMember(db, concordeGroupId, userId);

			if (membership) {
				await createCallRoom(db, {
					groupId,
					kind: 'group',
					concordeGroupId,
					participants: [userId],
					now: Date.now()
				});

				room = await getCallRoom(db, groupId);
			}
		}

		if (!room || room.expiresAt <= Date.now()) {
			return false;
		}

		let allowed = false;

		if (room.kind === 'dm') {
			allowed = await isCallRoomParticipant(db, groupId, userId);
		} else if (room.concordeGroupId) {
			allowed = (await findGroupMember(db, room.concordeGroupId, userId)) !== null;
		} else {
			allowed = await isCallRoomParticipant(db, groupId, userId);
		}

		if (allowed) {
			await touchCallRoom(db, groupId, Date.now());
		}

		return allowed;
	}

	async alarm(): Promise<void> {
		await this.loadPersistedState();

		if (this.isDmCall() && this.callState === 'ringing' && !this.decided) {
			if (this.ringStartedAt) {
				const elapsed = Date.now() - this.ringStartedAt;
				if (elapsed >= CALL_RING_TIMEOUT_MS) {
					await this.expireRingingCall();
					return;
				}
				await this.ctx.storage.setAlarm(this.ringStartedAt + CALL_RING_TIMEOUT_MS);
				return;
			}
		}

		if (this.clients.size > 0) {
			if (this.roomId) {
				try {
					await touchCallRoom(this.env.concorde_users, this.roomId, Date.now());
				} catch {}
			}

			await this.ctx.storage.setAlarm(Date.now() + ROOM_RENEWAL_INTERVAL_MS);
			return;
		}

		if (this.roomId) {
			try {
				await deleteCallRoom(this.env.concorde_users, this.roomId);
			} catch {}
		}
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
				console.error('Falha no broadcast da call:', error);
			}
		}
	}

	private forward(server: WebSocket, message: DirectClientMessage): void {
		const from = this.clients.get(server)?.userId ?? '';
		const target = this.findClient(message.to);
		if (!target) return;
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