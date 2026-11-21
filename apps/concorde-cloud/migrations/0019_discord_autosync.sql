ALTER TABLE auth_accounts ADD COLUMN providerDisplayName TEXT;
UPDATE auth_accounts SET providerDisplayName = providerUsername WHERE provider = 'discord';

ALTER TABLE users ADD COLUMN discordAutoSync INTEGER NOT NULL DEFAULT 0;
