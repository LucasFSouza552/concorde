import { Hono } from "hono";

import { acceptCallController, cancelCallController, createCallController, createGroupCallController, declineCallController } from "./calls.controller";
import { authMiddleware } from "../../middleware/auth";
import { Env } from "../../types/Env";

const calls = new Hono<{ Bindings: Env, Variables: { userId: string } }>();
calls.use("*", authMiddleware);

calls.post("/", createCallController);
calls.post("/group", createGroupCallController);
calls.post("/:id/accept", acceptCallController);
calls.post("/:id/decline", declineCallController);
calls.post("/:id/cancel", cancelCallController);

export default calls;