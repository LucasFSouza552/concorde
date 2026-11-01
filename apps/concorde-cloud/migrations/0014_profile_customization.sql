-- Customização leve de perfil: foto (dataURL comprimido pelo cliente) e cor de destaque.
ALTER TABLE users ADD COLUMN avatar TEXT;
ALTER TABLE users ADD COLUMN accent TEXT;
