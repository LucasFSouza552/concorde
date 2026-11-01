-- Política de atualização forçada + visibilidade das versões instaladas
ALTER TABLE users ADD COLUMN appVersion TEXT;
ALTER TABLE users ADD COLUMN appVersionAt INTEGER;

-- Metadados do app controlados pelo admin (minVersion / latestVersion).
CREATE TABLE app_meta (
	key TEXT PRIMARY KEY,
	value TEXT NOT NULL,
	updatedAt INTEGER NOT NULL
);
