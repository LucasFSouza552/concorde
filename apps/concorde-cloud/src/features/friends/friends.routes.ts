import { Hono } from "hono";

import { acceptRequestController, declineRequestController, listFriendsController, listRequestController, removeFriendController, searchUsersController, sendRequestController } from "./friends.controller";
import { authMiddleware } from "../../middleware/auth";
import { Env } from "../../types/Env";

const friends = new Hono<{ Bindings: Env; Variables: { userId: string }}>();

friends.use("*", authMiddleware);

friends.get("/", listFriendsController);

friends.get("/requests", listRequestController);

friends.get("/search", searchUsersController);

friends.post("/requests", sendRequestController);

friends.post("/requests/:friendId/accept", acceptRequestController);

friends.post("/requests/:friendId/decline", declineRequestController);

friends.delete("/friend/:friendId", removeFriendController);

export default friends;