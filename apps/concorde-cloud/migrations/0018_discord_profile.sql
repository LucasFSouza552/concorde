ALTER TABLE users ADD COLUMN discordShowcase INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN discordVerified INTEGER NOT NULL DEFAULT 0;

ALTER TABLE auth_accounts ADD COLUMN verified INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS discord_events (
	id TEXT PRIMARY KEY,
	userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	kind TEXT NOT NULL CHECK (kind IN ('linked', 'login', 'sync', 'unlinked')),
	metadata TEXT,
	createdAt INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_discord_events_user ON discord_events(userId, createdAt DESC);

CREATE TABLE IF NOT EXISTS oauth_confirmations (
	id TEXT PRIMARY KEY,
	userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	action TEXT NOT NULL CHECK (action IN ('email', 'password')),
	createdAt INTEGER NOT NULL,
	expiresAt INTEGER NOT NULL,
	consumedAt INTEGER
);
CREATE INDEX IF NOT EXISTS idx_oauth_confirmations_expires ON oauth_confirmations(expiresAt);

CREATE TABLE oauth_transactions_new (
	id TEXT PRIMARY KEY,
	stateHash TEXT NOT NULL UNIQUE,
	codeVerifier TEXT NOT NULL,
	purpose TEXT NOT NULL CHECK (purpose IN ('login', 'link', 'sync', 'reauth')),
	action TEXT,
	userId TEXT,
	createdAt INTEGER NOT NULL,
	expiresAt INTEGER NOT NULL,
	consumedAt INTEGER
);

INSERT INTO oauth_transactions_new (id, stateHash, codeVerifier, purpose, action, userId, createdAt, expiresAt, consumedAt)
SELECT id, stateHash, codeVerifier, purpose, NULL, userId, createdAt, expiresAt, consumedAt FROM oauth_transactions;

DROP TABLE oauth_transactions;
ALTER TABLE oauth_transactions_new RENAME TO oauth_transactions;
CREATE INDEX IF NOT EXISTS idx_oauth_transactions_expires ON oauth_transactions(expiresAt);
