import { Hono } from "hono";

import { getPolicyController, listClientsController, reportVersionController, setPolicyController } from "./updates.controller";
import { authMiddleware } from "../../middleware/auth";
import { rateLimitMiddleware } from "../../utils/rate-limit";
import type { Env } from "../../types/Env";

const updates = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

// Público: o app consulta no boot para saber se precisa bloquear por versão.
updates.get("/policy", getPolicyController);

// Autenticado: o cliente confirma qual versão está rodando.
updates.post("/report", authMiddleware, rateLimitMiddleware("updates-report", 30, 60_000), reportVersionController);

// Admin: por header x-admin-token (ADMIN_TOKEN do Worker).
updates.put("/policy", setPolicyController);
updates.get("/clients", listClientsController);

export default updates;
