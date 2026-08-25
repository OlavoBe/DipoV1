-- Autoria da indicação: qual assessor a produziu.
--
-- Coluna NULLABLE de propósito. As 136 indicações que já existem não têm autor
-- e nunca terão — não há de onde inferir quem as gerou. Um NOT NULL exigiria
-- inventar um valor, e um valor inventado num campo de autoria é pior que a
-- ausência dele.
--
-- ON DELETE SET NULL: se o assessor sair do gabinete e o usuário for removido,
-- a indicação continua existindo. O documento é do gabinete, não da pessoa.

-- AlterTable
ALTER TABLE "Indicacao" ADD COLUMN     "userId" TEXT;

-- AddForeignKey
ALTER TABLE "Indicacao" ADD CONSTRAINT "Indicacao_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
