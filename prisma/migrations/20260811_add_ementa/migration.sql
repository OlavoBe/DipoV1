-- Ementa da indicação: o campo "Assunto" exigido no protocolo do SISCAM.
-- Nulo para as indicações geradas antes desta funcionalidade.
ALTER TABLE "Indicacao" ADD COLUMN IF NOT EXISTS "ementa" TEXT;
