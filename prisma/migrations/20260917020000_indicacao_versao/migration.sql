-- Historico de versoes de uma indicacao.
--
-- Ate aqui, cada "Regenerar com ajuste" criava uma indicacao NOVA: cinco
-- tentativas do mesmo pedido viravam cinco registros no historico, cinco no
-- total e cinco consumindo a cota do plano. Agora o ajuste vira versao da
-- mesma indicacao, e a instrucao que o assessor escreveu fica guardada.
CREATE TABLE "IndicacaoVersao" (
    "id" TEXT NOT NULL,
    "indicacaoId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "textoFinal" TEXT NOT NULL,
    "ementa" TEXT,
    "extractedJson" TEXT NOT NULL,
    "ajuste" TEXT,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IndicacaoVersao_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IndicacaoVersao_indicacaoId_idx" ON "IndicacaoVersao"("indicacaoId");

CREATE UNIQUE INDEX "IndicacaoVersao_indicacaoId_versao_key" ON "IndicacaoVersao"("indicacaoId", "versao");

ALTER TABLE "IndicacaoVersao" ADD CONSTRAINT "IndicacaoVersao_indicacaoId_fkey" FOREIGN KEY ("indicacaoId") REFERENCES "Indicacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;