import { Hono } from "hono";

import {
	addGroupMemberController,
	changeGroupMemberRoleController,
	createGroupController,
	listGroupsController,
	removeGroupMemberController
} from "./groups.controller";
import { authMiddleware } from "../../middleware/auth";
import type { Env } from "../../types/Env";

const groups = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

groups.use("*", authMiddleware);

groups.post("/", createGroupController);
groups.get("/", listGroupsController);
groups.post("/:groupId/members", addGroupMemberController);
groups.delete("/:groupId/members/:userId", removeGroupMemberController);
groups.patch("/:groupId/members/:userId", changeGroupMemberRoleController);

export default groups;