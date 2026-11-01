-- Códigos de recuperação de senha (enviados por email, uso único).
CREATE TABLE IF NOT EXISTS password_resets (
    id        TEXT PRIMARY KEY,
    userId    TEXT NOT NULL,
    codeHash  TEXT NOT NULL,
    attempts  INTEGER NOT NULL DEFAULT 0,
    createdAt INTEGER NOT NULL,
    expiresAt INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(userId);
CREATE INDEX IF NOT EXISTS idx_password_resets_expires ON password_resets(expiresAt);
