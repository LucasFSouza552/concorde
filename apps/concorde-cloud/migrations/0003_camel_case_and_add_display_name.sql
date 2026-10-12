ALTER TABLE users RENAME COLUMN password_hash TO passwordHash;
ALTER TABLE users RENAME COLUMN password_salt TO passwordSalt;
ALTER TABLE users RENAME COLUMN created_at TO createdAt;

ALTER TABLE users ADD COLUMN displayName TEXT NOT NULL DEFAULT "";

UPDATE users SET displayName = username;
