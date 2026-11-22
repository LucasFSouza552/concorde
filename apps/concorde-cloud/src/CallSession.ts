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
const PEER_LEFT_GRACE_MS = 2500;

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
	private watchers = new Map<string, Set<string>>();
	private leaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
	private signalingEpoch = 0;

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
			const epoch = await this.ctx.storage.get<number>('signalingEpoch');
			if (typeof epoch === 'number') this.signalingEpoch = epoch;
		} catch (error) { void error; }
	}

	private async bumpSignalingEpoch(): Promise<number> {
		this.signalingEpoch += 1;
		try {
			await this.ctx.storage.put('signalingEpoch', this.signalingEpoch);
		} catch (error) { void error; }
		return this.signalingEpoch;
	}

	private async persistState(): Promise<void> {
		try {
			await this.ctx.storage.put<PersistedCallState>('callState', {
				callState: this.callState,
				ringStartedAt: this.ringStartedAt,
				decided: this.decided
			});
		} catch (error) { void error; }
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
			} catch (error) { void error; }
		}

		if (this.roomId) {
			try {
				await deleteCallRoom(this.env.concorde_users, this.roomId);
			} catch (error) { void error; }
		}

		for (const timer of this.leaveTimers.values()) clearTimeout(timer);
		this.leaveTimers.clear();
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
				} catch (error) { void error; }
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
					const from = this.clients.get(server)?.userId ?? '';
					const current = this.watchers.get(message.target) ?? new Set<string>();
					if (message.watching) current.add(from);
					else current.delete(from);
					if (current.size === 0) this.watchers.delete(message.target);
					else this.watchers.set(message.target, current);
					this.broadcast(server, {
						type: 'screen-watch',
						target: message.target,
						watching: message.watching,
						from
					});
					break;
				}
			}
		});

		server.addEventListener('close', () => {
			const peer = this.clients.get(server);
			this.clients.delete(server);

			if (peer?.joined && !this.findClient(peer.userId)) {
				const timer = setTimeout(() => {
					this.leaveTimers.delete(peer.userId);
					if (this.findClient(peer.userId)) return;

					this.state.delete(peer.userId);
					this.watchers.delete(peer.userId);
					for (const [target, ids] of this.watchers) {
						ids.delete(peer.userId);
						if (ids.size === 0) this.watchers.delete(target);
					}
					this.broadcast(server, { type: 'peer-left', userId: peer.userId });
				}, PEER_LEFT_GRACE_MS);
				this.leaveTimers.set(peer.userId, timer);
			}

			if (this.clients.size === 0 && this.roomId) {
				void this.ctx.storage.setAlarm(Date.now() + ROOM_EMPTY_GRACE_MS);
			}
		});

		server.send(JSON.stringify({ type: 'connected', epoch: this.signalingEpoch }));

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
		}

		const pendingLeave = this.leaveTimers.get(verified.userId);
		if (pendingLeave) {
			clearTimeout(pendingLeave);
			this.leaveTimers.delete(verified.userId);
		}

		this.state.delete(verified.userId);
		await this.bumpSignalingEpoch();

		this.send(server, { type: 'peers', peers: this.getPeers() });

		for (const [userId, current] of this.state) {
			if (userId === verified.userId || !userId) continue;
			if (current.sharing) {
				this.send(server, { type: 'screen-share', sharing: true, from: userId });
			}
			if (current.muted || current.deafened) {
				this.send(server, { type: 'mute-state', muted: current.muted, deafened: current.deafened, from: userId });
			}
		}

		for (const [target, ids] of this.watchers) {
			if (target === verified.userId) {
				for (const from of ids) {
					this.send(server, { type: 'screen-watch', target, watching: true, from });
				}
			}
			if (ids.has(verified.userId)) {
				this.broadcast(server, { type: 'screen-watch', target, watching: true, from: verified.userId });
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

		let allowed: boolean;

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
				} catch (error) { void error; }
			}

			await this.ctx.storage.setAlarm(Date.now() + ROOM_RENEWAL_INTERVAL_MS);
			return;
		}

		if (this.roomId) {
			try {
				await deleteCallRoom(this.env.concorde_users, this.roomId);
			} catch (error) { void error; }
		}
	}

	private getPeers(): Peer[] {
		return [...this.clients.values()]
			.filter((peer) => peer.joined)
			.map(({ userId, username }) => ({ userId, username }));
	}

	private send(socket: WebSocket, message: ServerMessage): void {
		socket.send(JSON.stringify({ ...message, epoch: this.signalingEpoch }));
	}

	private broadcast(sender: WebSocket, message: ServerMessage) {
		const stamped = { ...message, epoch: this.signalingEpoch };
		for (const client of this.clients.keys()) {
			if (client === sender) continue;
			try {
				client.send(JSON.stringify(stamped));
			} catch (error) {
				console.error('Falha no broadcast da call:', error);
			}
		}
	}

	private forward(server: WebSocket, message: DirectClientMessage): void {
		const from = this.clients.get(server)?.userId ?? '';
		const target = this.findClient(message.to);
		if (!target) return;
		this.send(target, { ...message, from } satisfies ServerMessage);
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