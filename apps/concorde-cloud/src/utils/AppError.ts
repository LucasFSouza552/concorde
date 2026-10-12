import { ContentfulStatusCode } from "hono/utils/http-status";

export class AppError extends Error {
    constructor(
        message: string,
        public status: ContentfulStatusCode
    ) {
        super(message);
    }

    /** Erro 400 — Requisição inválida. */
    static badRequest(message: string) {
        return new AppError(message, 400);
    }

    /** Erro 401 — Usuário não autenticado. */
    static unauthorized(message: string) {
        return new AppError(message, 401);
    }

    /** Erro 403 — Usuário sem permissão para realizar a ação. */
    static forbidden(message: string) {
        return new AppError(message, 403);
    }

    /** Erro 404 — Recurso não encontrado. */
    static notFound(message: string) {
        return new AppError(message, 404);
    }

    /** Erro 409 — Conflito com o estado atual do recurso. */
    static conflict(message: string) {
        return new AppError(message, 409);
    }

    /** Erro 500 — Falha interna inesperada do servidor. */
    static internal(message: string) {
        return new AppError(message, 500);
    }
}