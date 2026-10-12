CREATE TABLE channels (
	id TEXT PRIMARY KEY,
	groupId TEXT REFERENCES groups(id) ON DELETE CASCADE,
	name TEXT,
	kind TEXT NOT NULL CHECK (kind IN ('dm', 'group')),
	dmKey TEXT UNIQUE,
	createdAt INTEGER NOT NULL
);

CREATE TABLE channel_users (
	channelId TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
	userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	joinedAt INTEGER NOT NULL,
	PRIMARY KEY (channelId, userId)
);

CREATE TABLE messages (
	id TEXT PRIMARY KEY,
	channelId TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
	userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	kind TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'image')),
	content TEXT NOT NULL CHECK(length(trim(content)) > 0),
	createdAt INTEGER NOT NULL
);

CREATE INDEX idx_messages_channel_created ON messages(channelId, createdAt);
