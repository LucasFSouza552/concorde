import { Hono } from "hono";

import { acceptCallController, cancelCallController, createCallController, createGroupCallController, declineCallController } from "./calls.controller";
import { authMiddleware } from "../../middleware/auth";
import { rateLimitMiddleware } from "../../utils/rate-limit";
import { Env } from "../../types/Env";

const calls = new Hono<{ Bindings: Env, Variables: { userId: string } }>();
calls.use("*", authMiddleware);

// Limita criação e resposta de chamadas por usuário (janela de 60s).
calls.post("/", rateLimitMiddleware("call-create", 30, 60_000), createCallController);
calls.post("/group", rateLimitMiddleware("call-create", 30, 60_000), createGroupCallController);
calls.post("/:id/accept", rateLimitMiddleware("call-answer", 60, 60_000), acceptCallController);
calls.post("/:id/decline", rateLimitMiddleware("call-answer", 60, 60_000), declineCallController);
calls.post("/:id/cancel", rateLimitMiddleware("call-answer", 60, 60_000), cancelCallController);

export default calls;