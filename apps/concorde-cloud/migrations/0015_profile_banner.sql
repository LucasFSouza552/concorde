-- Fundo personalizado do perfil: degradê de 2 cores (hex). NULL = tema padrão.
ALTER TABLE users ADD COLUMN bannerFrom TEXT;
ALTER TABLE users ADD COLUMN bannerTo TEXT;
