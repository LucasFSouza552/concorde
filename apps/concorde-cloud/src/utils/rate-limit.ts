import type { Context, Next } from "hono";

import { Env } from "../types/Env";

import { AppError } from "./AppError";

type AppContext = Context<{ Bindings: Env; Variables: { userId: string } }>;

/** Chance de aproveitar uma requisição para limpar baldes antigos (piggyback). */
const PURGE_CHANCE = 0.05;
/** Baldes sem atividade há mais de um dia podem ser removidos. */
const PURGE_OLDER_THAN_MS = 24 * 60 * 60 * 1000;

/**
 * Consome um bilhete do balde fixo (janela deslizante por contagem).
 * Devolve false quando o limite da janela atual foi estourado.
 */
async function consumeBucket(
    db: D1Database,
    bucket: string,
    limit: number,
    windowMs: number,
    now: number
): Promise<boolean> {
    const row = await db
        .prepare(`
            INSERT INTO rate_limits (bucket, count, windowStart)
            VALUES (?1, 1, ?2)
            ON CONFLICT(bucket) DO UPDATE SET
                count = CASE WHEN rate_limits.windowStart < ?3 THEN 1
                             ELSE rate_limits.count + 1 END,
                windowStart = CASE WHEN rate_limits.windowStart < ?3 THEN ?2
                                   ELSE rate_limits.windowStart END
            RETURNING count
        `)
        .bind(bucket, now, now - windowMs)
        .first<{ count: number }>();

    if (!row) return true;

    return row.count <= limit;
}

/** Remove baldes parados — chamada com baixa frequência, sem bloquear a resposta. */
async function purgeExpiredBuckets(db: D1Database): Promise<void> {
    await db
        .prepare("DELETE FROM rate_limits WHERE windowStart < ?")
        .bind(Date.now() - PURGE_OLDER_THAN_MS)
        .run();
}

/**
 * Middleware de rate limiting por janela fixa em D1.
 * Chave = scope + identity (userId quando autenticado, senão IP).
 */
export function rateLimitMiddleware(scope: string, limit: number, windowMs: number) {
    return async function rateLimit(c: AppContext, next: Next) {
        // Suíte de testes roda vários POSTs seguidos com o mesmo "IP".
        if (c.env.RATE_LIMIT_DISABLED === "1") {
            await next();
            return;
        }

        const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
		const identity = c.get("userId")
			?? c.req.header("cf-connecting-ip")
			?? forwarded
			?? "unknown";

        const now = Date.now();
        const allowed = await consumeBucket(c.env.concorde_users, `${scope}:${identity}`, limit, windowMs, now);

        if (Math.random() < PURGE_CHANCE) {
            const purge = purgeExpiredBuckets(c.env.concorde_users).catch(() => { });
            try {
                c.executionCtx.waitUntil(purge);
            } catch {
                void purge;
            }
        }

        if (!allowed) {
            throw AppError.tooManyRequests("Muitas requisições. Tente novamente em instantes.");
        }

        await next();
    };
}
