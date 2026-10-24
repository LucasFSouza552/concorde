CREATE TABLE IF NOT EXISTS auth_sessions (
	id TEXT PRIMARY KEY,
	userId TEXT NOT NULL,
	refreshHash TEXT NOT NULL,
	createdAt INTEGER NOT NULL,
	expiresAt INTEGER NOT NULL,
	lastUsedAt INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(userId);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON auth_sessions(expiresAt);
