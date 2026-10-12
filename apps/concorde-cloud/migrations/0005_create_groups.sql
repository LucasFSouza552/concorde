CREATE TABLE groups (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	ownerId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	createdAt INTEGER NOT NULL
);

CREATE TABLE group_members(
	groupId TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
	userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
	joinedAt INTEGER NOT NULL,
	PRIMARY KEY (groupId, userId)
);

CREATE INDEX idx_group_members_user ON group_members(userId);

CREATE INDEX idx_group_members_group_role ON group_members(groupId, role);
