CREATE TABLE call_rooms (
	groupId TEXT PRIMARY KEY,
	kind TEXT NOT NULL CHECK (kind IN ('dm', 'group')),
	concordeGroupId TEXT,
	createdAt INTEGER NOT NULL,
	expiresAt INTEGER NOT NULL
);

CREATE TABLE call_room_participants(
	groupId TEXT NOT NULL REFERENCES call_rooms(groupId) ON DELETE CASCADE,
	userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	joinedAt INTEGER NOT NULL,
	PRIMARY KEY (groupId, userId)
);

CREATE INDEX idx_call_room_participants_user ON call_room_participants(userId);

CREATE INDEX idx_call_rooms_expires ON call_rooms(expiresAt);
