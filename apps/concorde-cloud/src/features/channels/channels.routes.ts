import { Hono } from "hono";

import { createGroupChannelController, deleteMessageController, listChannelMembersController, listChannelsController, listMessagesController, resolveDMChannelController, sendMessageController } from "./channels.controller";
import { authMiddleware } from "../../middleware/auth";
import { Env } from "../../types/Env";

const channels = new Hono<{ Bindings: Env, Variables: { userId: string } }>();
channels.use("*", authMiddleware);

channels.get("/", listChannelsController);
channels.post("/dm", resolveDMChannelController);
channels.post("/group", createGroupChannelController);
channels.get("/:id/messages", listMessagesController);
channels.post("/:id/messages", sendMessageController);
channels.delete("/:id/messages/:messageId", deleteMessageController);
channels.get("/:id/members", listChannelMembersController);

export default channels;
