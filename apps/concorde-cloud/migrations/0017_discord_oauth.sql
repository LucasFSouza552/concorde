-- Identidades externas, transações OAuth e criação pendente de conta.
CREATE TABLE IF NOT EXISTS auth_accounts (
	id TEXT PRIMARY KEY,
	userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	provider TEXT NOT NULL,
	providerAccountId TEXT NOT NULL,
	providerUsername TEXT,
	providerAvatar TEXT,
	createdAt INTEGER NOT NULL,
	updatedAt INTEGER NOT NULL,
	UNIQUE (provider, providerAccountId),
	UNIQUE (userId, provider)
);
CREATE INDEX IF NOT EXISTS idx_auth_accounts_user ON auth_accounts(userId);

CREATE TABLE IF NOT EXISTS oauth_transactions (
	id TEXT PRIMARY KEY,
	stateHash TEXT NOT NULL UNIQUE,
	codeVerifier TEXT NOT NULL,
	purpose TEXT NOT NULL CHECK (purpose IN ('login', 'link')),
	userId TEXT,
	createdAt INTEGER NOT NULL,
	expiresAt INTEGER NOT NULL,
	consumedAt INTEGER
);
CREATE INDEX IF NOT EXISTS idx_oauth_transactions_expires ON oauth_transactions(expiresAt);

CREATE TABLE IF NOT EXISTS oauth_registrations (
	id TEXT PRIMARY KEY,
	provider TEXT NOT NULL,
	providerAccountId TEXT NOT NULL,
	email TEXT NOT NULL,
	username TEXT NOT NULL,
	displayName TEXT NOT NULL,
	avatar TEXT,
	createdAt INTEGER NOT NULL,
	expiresAt INTEGER NOT NULL,
	consumedAt INTEGER
);
CREATE INDEX IF NOT EXISTS idx_oauth_registrations_expires ON oauth_registrations(expiresAt);

-- Contas criadas sem senha (somente provedor externo) exigem senha antes de desvincular.
ALTER TABLE users ADD COLUMN hasPassword INTEGER NOT NULL DEFAULT 1;
