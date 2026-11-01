-- Janelas fixas de rate limiting por chave (ex.: "login:1.2.3.4").
CREATE TABLE rate_limits (
    bucket      TEXT PRIMARY KEY,
    count       INTEGER NOT NULL DEFAULT 0,
    windowStart INTEGER NOT NULL
);
