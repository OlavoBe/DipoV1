# Roadmap

Uma única lista, ordenada por dependência real. O critério de ordenação não é
esforço nem entusiasmo: é **o que impede a próxima coisa de acontecer**.

O produto está em beta com 4 gabinetes desde abril de 2026 e tecnicamente
estável desde o sprint de agosto. O que falta não é código de base — é fechar
o caminho do dinheiro, medir qualidade com dado real, e provar que embarcar um
gabinete novo não custa uma semana de curadoria manual.

---

## Fase 0 — Higiene (dias)

Coisas quebradas ou prestes a quebrar. Não produzem valor novo; evitam perda.

| # | Item | Estado |
|---|---|---|
| 0.1 | **Aplicar `20260811_add_ementa` em produção** | ⏳ bloqueado na `DATABASE_URL` |
| 0.2 | **Provider padrão = `openai`**, alinhado com a realidade do `.env` | ✅ feito |
| 0.3 | **E2E no CI** — job separado com Postgres, seed e LLM falso | ✅ [.github/workflows/e2e.yml](.github/workflows/e2e.yml) |
| 0.4 | **Limpar os tenants do beta** que não chegaram a usar | ⏳ script pronto, bloqueado na `DATABASE_URL` |
| 0.5 | Conferir `npx prisma migrate status` contra produção | ⏳ junto com 0.1 |

Sobre o 0.2: o default do código era `anthropic` enquanto o `.env` sempre
definiu `openai`. A divergência não quebrou nada — mas escondia um id morto
(`claude-3-5-haiku-20241022`, aposentado em 19/02/2026) que um ambiente novo
sem `.env` completo teria usado. Corrigido na origem.

O 0.4 usa [scripts/limpar-tenants.mjs](../scripts/limpar-tenants.mjs), que faz
dry-run por padrão e exige backup em `_Quarentena` antes de apagar.

---

## Fase 1 — Fechar o caminho do dinheiro (2–3 semanas)

Detalhado em [plano-distribuicao.md](plano-distribuicao.md) §2. Resumo:

| # | Item | Por quê |
|---|---|---|
| 1.1 | Assinatura recorrente (Mercado Pago `preapproval`) | Hoje um pagamento único dá acesso vitalício |
| 1.2 | `checkLimite` lê `planoAtivoEm` e expira plano vencido | O campo é escrito e nunca lido |
| 1.3 | Onboarding para de conceder plano `BETA` | Qualquer um que escolha um dos 4 vereadores ganha acesso ilimitado |
| 1.4 | Webhook com validação de assinatura e idempotência | Aceita POST forjado e reprocessa reenvio |
| 1.5 | CNPJ, nota fiscal, contrato, termos e política de privacidade | Sem isso não se vende a gabinete nem a Câmara |

**Critério de saída:** um estranho consegue assinar, ser cobrado no mês
seguinte e perder acesso ao parar de pagar — sem você tocar no Prisma Studio.

---

## Fase 2 — Conhecimento do corpus (paralela à Fase 1)

Piloto rodado com Márcio e Adriana: 1.897 ementas coletadas e analisadas
([corpus-siscam-piloto.md](corpus-siscam-piloto.md)). O que fazer com o achado,
em ordem de retorno sobre esforço:

| # | Item | Base |
|---|---|---|
| 2.1 | **Validar a ementa contra a fórmula** em vez de confiar no modelo — 99,5% de aderência medida torna isso regra, não heurística | Achado 1 |
| 2.2 | **`visando` como conector padrão quase absoluto** — `para que realize` aparece 13 vezes em 1.897 | Achado 1 |
| 2.3 | **Ampliar o enum `tipos_servico`** com as 7 categorias ausentes + `zeladoria` como serviço agregado | Achado 3 |
| 2.4 | **Categoria "propositura de política"** no extractor — sem endereço, sem serviço, justificativa longa | Achado 3 |
| 2.5 | **Few-shot amostrado do corpus** em vez de 2 exemplos escritos à mão por gabinete | Achado 2 |
| 2.6 | **Perfil do vereador derivado do corpus** (bairros, vocabulário, comprimento) em vez de escrito à mão | Achado 2 |
| 2.7 | Decidir o pipeline de OCR dos anexos (o corpo do texto só existe em scan) | Achado 4 |

Os itens 2.1–2.4 mexem em prompt que 4 gabinetes usam em produção. **Precisam
de comparação antes/depois numa amostra real antes de subir** — o que exige a
Fase 3.

**Critério de saída da fase:** embarcar um gabinete novo (Adriana é o teste)
sem escrever nenhum exemplo à mão, e o texto sair tão bom quanto o do Márcio.
Essa é a pergunta comercial da Fase 5 disfarçada de pergunta técnica.

---

## Fase 3 — Medir qualidade (1–2 semanas, habilita a Fase 2)

Hoje não existe forma de saber se uma mudança de prompt melhorou ou piorou o
texto. Sem isso, tudo na Fase 2 é aposta.

| # | Item |
|---|---|
| 3.1 | Conjunto de avaliação: 30–50 pedidos reais com a indicação publicada correspondente como referência |
| 3.2 | Script que roda o pipeline no conjunto e salva a saída, versionada por commit |
| 3.3 | Comparação antes/depois de mudanças de prompt (aderência à fórmula, presença dos campos, comprimento) |
| 3.4 | Instrumentar `usage` da API por indicação para custo real por gabinete |

Barato de construir e paga por si na primeira mudança de prompt que não
quebrar nada.

---

## Fase 4 — Operação (paralela, contínua)

| # | Item | Por quê |
|---|---|---|
| 4.1 | Monitoramento de erro (Sentry) | Hoje erro em produção só aparece se o gabinete reclamar |
| 4.2 | Restaurar um backup do Postgres, de verdade, uma vez | Backup não testado é fé |
| 4.3 | Canal de suporte com SLA declarado | Sessão de Câmara tem hora marcada |
| 4.4 | Painel de uso por gabinete | Prova de valor na renovação e alerta de churn |
| 4.5 | Deploy que aplica migrations com segurança | Elimina a classe inteira de erro do item 0.1 |

---

## Fase 5 — Distribuição (após 1 e 3)

As quatro ondas estão em [plano-distribuicao.md](plano-distribuicao.md) §4:
fechar a torneira → converter o beta → Guarujá inteira → segunda cidade e
proposta institucional.

A primeira ação não é código: **cronometrar com os gabinetes beta quanto tempo
uma indicação levava antes e leva agora.** Esse número decide o preço e escreve
o material de venda.

---

## Fase 6 — Produto novo (depois de existir receita)

Estava no README como "ganchos para futuras versões". Reordenado pelo que o
corpus e o uso real mostraram importar:

| # | Item | Observação |
|---|---|---|
| 6.1 | **Geração em lote** | 25 indicações/mês por gabinete, muitas do mesmo bairro no mesmo dia. É o pedido óbvio de quem já usa. |
| 6.2 | **Upload de foto + OCR** | O assessor recebe foto do munícipe por WhatsApp. Hoje redigita tudo. |
| 6.3 | **Numeração sequencial oficial** | Baixo esforço, fecha mais um passo manual do protocolo. |
| 6.4 | **Dashboard por bairro e tipo** | O corpus mostra concentração territorial forte (30% do Márcio em Vila Santa Rosa). Vira relatório de prestação de contas. |
| 6.5 | **Integração WhatsApp** | O maior salto de conveniência e o maior custo. Depois de tudo acima. |

---

## O que **não** está no roadmap, de propósito

- **Trocar o modelo de geração para `claude-sonnet-5`.** Está disponível e é
  melhor, mas muda o texto dos 4 gabinetes de uma vez. Só depois da Fase 3, com
  comparação antes/depois — nunca "porque saiu um modelo novo".
- **Fine-tuning.** O `export-finetuning.ts` existe e o feedback 👍/👎 está
  sendo coletado, mas few-shot bem escolhido do corpus real (2.5) resolve o
  mesmo problema por ordens de grandeza menos esforço. Reconsiderar só se
  2.5 falhar.
- **Multi-cidade genérico.** O padrão da ementa é de cada Casa. Generalizar
  antes de provar em uma segunda cidade é construir abstração para um requisito
  imaginado.
