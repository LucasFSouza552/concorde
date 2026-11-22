import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const RUN = Date.now();

type Session = {
    token: string;
    user: { id: string; username: string };
};

function uniqueEmail(label: string): string {
    return `${label}.${RUN}@concorde.test`;
}

function uniqueUsername(label: string): string {
    return `fr_${label}_${RUN}`.toLowerCase();
}

function bearer(token: string) {
    return { Authorization: `Bearer ${token}` };
}

async function register(label: string): Promise<Session> {
    const response = await SELF.fetch("https://example.com/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            email: uniqueEmail(label),
            password: `senha-${RUN}-${label}`,
            username: uniqueUsername(label),
        }),
    });

    expect(response.status).toBe(201);
    return (await response.json()) as Session;
}

function sendRequest(from: Session, to: Session) {
    return SELF.fetch("https://example.com/friends/requests", {
        method: "POST",
        headers: { ...bearer(from.token), "Content-Type": "application/json" },
        body: JSON.stringify({ username: to.user.username }),
    });
}

async function getRelationship(viewer: Session, target: Session): Promise<string> {
    const response = await SELF.fetch(`https://example.com/friends/relationship/${target.user.id}`, {
        headers: bearer(viewer.token),
    });
    expect(response.status).toBe(200);
    return (await response.json<{ state: string }>()).state;
}

async function getMutualIds(viewer: Session, target: Session): Promise<string[]> {
    const response = await SELF.fetch(`https://example.com/friends/mutual/${target.user.id}`, {
        headers: bearer(viewer.token),
    });
    expect(response.status).toBe(200);
    return (await response.json<{ ids: string[] }>()).ids;
}

async function makeFriends(first: Session, second: Session) {
    const sent = await sendRequest(first, second);
    expect(sent.status).toBe(201);

    const accepted = await SELF.fetch(`https://example.com/friends/requests/${first.user.id}/accept`, {
        method: "POST",
        headers: bearer(second.token),
    });
    expect(accepted.status).toBe(200);
}

describe("relacionamento de amizade", () => {
    it("exige autenticação nas rotas de relacionamento e amigos em comum", async () => {
        const stranger = await register("socialauth");

        const relationship = await SELF.fetch(`https://example.com/friends/relationship/${stranger.user.id}`);
        expect(relationship.status).toBe(401);

        const mutual = await SELF.fetch(`https://example.com/friends/mutual/${stranger.user.id}`);
        expect(mutual.status).toBe(401);
    });

    it("normaliza self, pendente nos dois sentidos e amizade aceita", async () => {
        const alice = await register("socialalice");
        const bob = await register("socialbob");

        expect(await getRelationship(alice, alice)).toBe("self");
        expect(await getRelationship(alice, bob)).toBe("none");
        expect(await getRelationship(bob, alice)).toBe("none");

        const sent = await sendRequest(alice, bob);
        expect(sent.status).toBe(201);

        expect(await getRelationship(alice, bob)).toBe("pending-out");
        expect(await getRelationship(bob, alice)).toBe("pending-in");

        const duplicate = await sendRequest(alice, bob);
        expect(duplicate.status).toBe(409);
        expect((await duplicate.json<{ message: string }>()).message).toBe("Já existe um pedido pendente.");

        const reverseDuplicate = await sendRequest(bob, alice);
        expect(reverseDuplicate.status).toBe(409);

        const cancelled = await SELF.fetch(`https://example.com/friends/requests/${bob.user.id}/decline`, {
            method: "POST",
            headers: bearer(alice.token),
        });
        expect(cancelled.status).toBe(200);
        expect(await getRelationship(alice, bob)).toBe("none");
        expect(await getRelationship(bob, alice)).toBe("none");

        const resent = await sendRequest(alice, bob);
        expect(resent.status).toBe(201);

        const accepted = await SELF.fetch(`https://example.com/friends/requests/${alice.user.id}/accept`, {
            method: "POST",
            headers: bearer(bob.token),
        });
        expect(accepted.status).toBe(200);

        expect(await getRelationship(alice, bob)).toBe("friend");
        expect(await getRelationship(bob, alice)).toBe("friend");

        const already = await sendRequest(alice, bob);
        expect(already.status).toBe(409);
        expect((await already.json<{ message: string }>()).message).toBe("Vocês já são amigos.");
    });

    it("retorna 404 para alvo inexistente", async () => {
        const viewer = await register("socialmissing");

        const relationship = await SELF.fetch("https://example.com/friends/relationship/concorde-usuario-inexistente", {
            headers: bearer(viewer.token),
        });
        expect(relationship.status).toBe(404);

        const mutual = await SELF.fetch("https://example.com/friends/mutual/concorde-usuario-inexistente", {
            headers: bearer(viewer.token),
        });
        expect(mutual.status).toBe(404);
    });
});

describe("amigos em comum", () => {
    it("retorna só amizades aceitas, sem self e respeitando privacidade", async () => {
        const alice = await register("mutualalice");
        const bob = await register("mutualbob");
        const carol = await register("mutualcarol");
        const dave = await register("mutualdave");
        const outsider = await register("mutualoutsider");

        await makeFriends(alice, carol);
        await makeFriends(bob, carol);
        await makeFriends(alice, bob);

        expect(await getMutualIds(alice, bob)).toEqual([carol.user.id]);
        expect(await getMutualIds(bob, alice)).toEqual([carol.user.id]);

        const aliceToDave = await sendRequest(alice, dave);
        const bobToDave = await sendRequest(bob, dave);
        expect(aliceToDave.status).toBe(201);
        expect(bobToDave.status).toBe(201);

        expect(await getMutualIds(alice, bob)).toEqual([carol.user.id]);
        expect(await getMutualIds(alice, alice)).toEqual([]);
        expect(await getMutualIds(outsider, bob)).toEqual([]);
    });
});
