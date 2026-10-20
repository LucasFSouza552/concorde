import { Hono } from "hono";

import {
	addGroupMemberController,
	changeGroupMemberRoleController,
	createGroupController,
	dissolveGroupController,
	leaveGroupController,
	listGroupMembersController,
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
groups.get("/:groupId/members", listGroupMembersController);
groups.post("/:groupId/leave", leaveGroupController);
groups.delete("/:groupId", dissolveGroupController);

export default groups;