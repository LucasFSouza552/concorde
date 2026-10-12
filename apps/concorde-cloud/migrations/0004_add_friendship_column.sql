CREATE TABLE friendships (
	userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	friendId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
	createdAt INTEGER NOT NULL,
	PRIMARY KEY (userId, friendId),
	CHECK (userId <> friendId)
);

CREATE INDEX idx_friendships_user_status ON friendships(userId, status);

CREATE INDEX idx_friendships_friend_status ON friendships(friendId, status);
