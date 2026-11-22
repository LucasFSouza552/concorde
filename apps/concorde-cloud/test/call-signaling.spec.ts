import { describe, expect, it } from "vitest";

import type { ServerMessage } from "@concorde/shared";
import { CallSession } from "../src/CallSession";
import type { Env } from "../src/types/Env";

const ROOM_ID = "group:call-signaling-test";
const GROUP_ID = "call-signaling-test";

type StoredRow = Record<string, unknown>;

class FakeStatement {
    private db: FakeD1;
    private sql: string;
    private values: unknown[];

    constructor(db: FakeD1, sql: string, values: unknown[]) {
        this.db = db;
        this.sql = sql;
        this.values = values;
    }

    bind(...values: unknown[]): FakeStatement {
        return new FakeStatement(this.db, this.sql, values);
    }

    async first<T>(): Promise<T | null> {
        return this.db.first<T>(this.sql, this.values);
    }

    async all<T>(): Promise<{ results: T[] }> {
        return { results: this.db.all<T>(this.sql, this.values) };
    }

    async run(): Promise<{ success: boolean }> {
        return { success: true };
    }
}

class FakeD1 {
    private users = new Map<string, StoredRow>();
    private members = new Set<string>();
    private room = {
        groupId: ROOM_ID,
        kind: "group",
        concordeGroupId: GROUP_ID,
        createdAt: Date.now(),
        expiresAt: Date.now() + 3_600_000
    };

    prepare(sql: string): FakeStatement {
        return new FakeStatement(this, sql, []);
    }

    async batch(statements: Array<{ run(): Promise<unknown> }>): Promise<unknown[]> {
        const results: unknown[] = [];
        for (const statement of statements) results.push(await statement.run());
        return results;
    }

    addUser(userId: string, displayName: string): void {
        this.users.set(userId, {
            id: userId,
            username: userId,
            displayName,
            email: `${userId}@test.local`,
            friendsOnly: 0,
            createdAt: Date.now(),
            avatar: null,
            bannerFrom: null,
            bannerTo: null,
            hasPassword: 1,
            discordShowcase: 0,
            discordVerified: 0,
            discordAutoSync: 0
        });
        this.members.add(`${GROUP_ID}:${userId}`);
    }

    first<T>(sql: string, values: unknown[]): T | null {
        if (sql.includes("FROM users")) {
            return (this.users.get(String(values[0])) ?? null) as T | null;
        }
        if (sql.includes("FROM group_members")) {
            const key = `${String(values[0])}:${String(values[1])}`;
            if (!this.members.has(key)) return null;
            return {
                groupId: String(values[0]),
                userId: String(values[1]),
                role: "member",
                joinedAt: Date.now()
            } as T;
        }
        return null;
    }

    all<T>(sql: string, values: unknown[]): T[] {
        void values;
        if (sql.includes("FROM call_rooms")) return [this.room as T];
        return [];
    }
}

interface TestClient {
    ws: WebSocket;
    messages: ServerMessage[];
}

function createSession(): { session: CallSession; db: FakeD1 } {
    const db = new FakeD1();
    const storage = new Map<string, unknown>();
    const ctx = {
        storage: {
            get: async (key: string) => storage.get(key),
            put: async (key: string, value: unknown) => {
                storage.set(key, value);
            },
            setAlarm: async () => {}
        },
        id: { name: ROOM_ID }
    } as unknown as DurableObjectState;
    const env = { concorde_users: db } as unknown as Env;

    return { session: new CallSession(ctx, env), db };
}

async function connect(session: CallSession, userId: string): Promise<TestClient> {
    const response = await session.fetch(new Request("https://example.com/call", {
        headers: {
            Upgrade: "websocket",
            "x-verified-user": userId,
            "x-call-room": ROOM_ID
        }
    }));

    const ws = response.webSocket;
    if (!ws) throw new Error("WebSocket não retornado pelo Durable Object.");
    ws.accept();

    const messages: ServerMessage[] = [];
    ws.addEventListener("message", (event) => {
        messages.push(JSON.parse(String(event.data)) as ServerMessage);
    });

    return { ws, messages };
}

async function join(client: TestClient, userId: string): Promise<void> {
    client.ws.send(JSON.stringify({ type: "join", userId, username: userId }));
    await waitFor(() => client.messages.some((message) => message.type === "peers"));
}

async function waitFor(predicate: () => boolean, timeoutMs = 1500): Promise<void> {
    const started = Date.now();
    while (!predicate()) {
        if (Date.now() - started > timeoutMs) throw new Error("Condição não atingida a tempo.");
        await new Promise((resolve) => setTimeout(resolve, 5));
    }
}

describe("sinalização de chamada no Durable Object", () => {
    it("carimba epoch crescente e preserva a geração ICE nas mensagens diretas", async () => {
        const { session, db } = createSession();
        db.addUser("alice", "Alice");
        db.addUser("bob", "Bob");

        const alice = await connect(session, "alice");
        await join(alice, "alice");
        const bob = await connect(session, "bob");
        await join(bob, "bob");

        const alicePeers = alice.messages.find((message) => message.type === "peers");
        const bobPeers = bob.messages.find((message) => message.type === "peers");
        expect(alicePeers?.epoch).toBe(1);
        expect(bobPeers?.epoch).toBe(2);

        const joined = alice.messages.find((message) => message.type === "peer-joined" && message.peer.userId === "bob");
        expect(joined?.epoch).toBe(2);

        alice.ws.send(JSON.stringify({ type: "offer", to: "bob", sdp: "v=0", generation: 3 }));
        await waitFor(() => bob.messages.some((message) => message.type === "offer"));

        const offer = bob.messages.find((message) => message.type === "offer");
        expect(offer?.epoch).toBe(2);
        if (offer?.type === "offer") expect(offer.generation).toBe(3);

        alice.ws.close();
        bob.ws.close();
    });

    it("não emite peer-left ao substituir um socket pelo mesmo usuário", async () => {
        const { session, db } = createSession();
        db.addUser("alice", "Alice");
        db.addUser("bob", "Bob");

        const alice = await connect(session, "alice");
        await join(alice, "alice");
        const bob = await connect(session, "bob");
        await join(bob, "bob");

        const replacement = await connect(session, "alice");
        await join(replacement, "alice");
        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(alice.messages.some((message) => message.type === "peer-left" && message.userId === "alice")).toBe(false);
        expect(bob.messages.some((message) => message.type === "peer-left" && message.userId === "alice")).toBe(false);

        alice.ws.close();
        bob.ws.close();
        replacement.ws.close();
    });

    it("replaya watchers de tela para o participante que reconecta", async () => {
        const { session, db } = createSession();
        db.addUser("alice", "Alice");
        db.addUser("bob", "Bob");

        const alice = await connect(session, "alice");
        await join(alice, "alice");
        const bob = await connect(session, "bob");
        await join(bob, "bob");

        alice.ws.send(JSON.stringify({ type: "screen-watch", target: "bob", watching: true }));
        await waitFor(() => bob.messages.some((message) => message.type === "screen-watch" && message.watching));

        const bobReconnected = await connect(session, "bob");
        await join(bobReconnected, "bob");

        const replayed = bobReconnected.messages.find(
            (message) => message.type === "screen-watch" && message.from === "alice" && message.watching
        );
        expect(replayed).toBeDefined();

        alice.ws.close();
        bob.ws.close();
        bobReconnected.ws.close();
    });
});
