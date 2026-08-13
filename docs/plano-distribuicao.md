# Plano de distribuição

O produto está tecnicamente pronto e comercialmente fechado: 4 gabinetes usam,
ninguém paga, e o caminho do dinheiro tem furos que só aparecem quando um
estranho tenta virar cliente sozinho. Este documento é o inverso do roadmap
técnico — parte de "quem assina o cheque" e volta até "o que falta no código".

---

## 1. A unidade econômica já fecha

Medido no corpus real (`docs/corpus-siscam-piloto.md`), um gabinete protocola
**18 a 26 indicações por mês** — Márcio 218–287/ano, Adriana 279–306/ano. Não
é um produto de alto volume; é de alta frequência e baixo esforço por uso.

Custo de LLM por indicação, com os modelos configurados hoje:

| Etapa | Modelo | Entrada | Saída | Custo |
|---|---|---:|---:|---:|
| Extração | `claude-haiku-4-5` ($1 / $5 por Mtok) | ~2,2k | ~0,5k | US$ 0,0047 |
| Ementa | `claude-haiku-4-5` | ~1,2k | ~0,1k | US$ 0,0017 |
| Geração | Sonnet ($3 / $15 por Mtok) | ~4k | ~0,9k | US$ 0,0255 |
| | | | **total** | **≈ US$ 0,032** |

A R$ 5,40 por dólar isso dá **≈ R$ 0,17 por indicação**, ou **≈ R$ 4,30 por
gabinete por mês**. Contra R$ 197 do plano Gabinete, o custo variável é **2%
da receita**. A conta não é o problema — a distribuição é.

> Os tokens de entrada são estimativa de prompt + few-shot; a ordem de grandeza
> é o que importa. Vale re-medir com `usage` real depois dos primeiros pagantes.

---

## 2. Requisitos de lançamento — o que trava hoje

Dividido pelo que acontece se ignorar. Os bloqueadores não são "seria bom":
sem eles, cobrar dá prejuízo ou dá processo.

### Bloqueadores — nada de cobrança antes disso

| # | O que está quebrado | Onde | Consequência de ignorar |
|---|---|---|---|
| B1 | **Pagamento único vira acesso vitalício.** `createPreference` cria uma preferência avulsa, não assinatura. O webhook grava `planoAtivoEm` e `checkLimite` nunca lê esse campo. | [lib/mercadopago.ts](lib/mercadopago.ts), [app/api/webhooks/mercadopago/route.ts:43](app/api/webhooks/mercadopago/route.ts:43), [lib/planos.ts](lib/planos.ts) | O cliente paga R$ 97 uma vez e usa para sempre. Não existe receita recorrente — existe uma venda única mal precificada. |
| B2 | **Plano BETA ilimitado é auto-serviço.** Quem escolher um dos 4 vereadores no dropdown do onboarding recebe `plano: 'BETA'`, sem limite e sem pagar. | [app/api/tenant/setup/route.ts:84-93](app/api/tenant/setup/route.ts:84) | Abrir para fora com isso é distribuir o produto de graça para qualquer um que saiba clicar. |
| B3 | **Webhook sem validação de assinatura nem idempotência.** Aceita qualquer POST e sempre devolve 200. | [app/api/webhooks/mercadopago/route.ts](app/api/webhooks/mercadopago/route.ts) | Ativação de plano por requisição forjada; reenvio do Mercado Pago reprocessando o mesmo pagamento. |
| B4 | **Sem CNPJ e sem nota fiscal.** | — | Câmara não empenha sem nota. Fecha o canal institucional inteiro, que é o de maior valor. |
| B5 | **Sem contrato, termos de uso e política de privacidade.** O sistema processa nome, endereço e telefone de munícipes. | — | LGPD. Um gabinete com assessoria jurídica não assina sem isso, e está certo. |
| B6 | **Migration aplicada à mão.** O deploy não roda `migrate deploy`. | [README.md](README.md) | Já documentado. Com cliente pagante, uma migration esquecida deixa de ser incômodo e vira incidente. |

### Necessários — não travam a primeira venda, travam a décima

| # | O quê | Por quê |
|---|---|---|
| N1 | Monitoramento de erro (Sentry ou similar) | Hoje um erro em produção só aparece se o gabinete reclamar. |
| N2 | Backup verificado do Postgres | O Railway faz backup; ninguém testou restaurar. Backup não testado é fé. |
| N3 | Canal de suporte com SLA declarado | Um gabinete que não consegue protocolar hoje precisa de resposta hoje. |
| N4 | Página de status / aviso de manutenção | Sessão de Câmara tem dia e hora; cair na véspera custa a conta. |
| N5 | Onboarding sem intervenção manual | Hoje o plano é ajustado no Prisma Studio. Não escala além de você. |
| N6 | Cancelamento self-service | Exigido pelo CDC e some com metade das disputas. |

### Desejáveis — aceleram, não bloqueiam

Painel de uso por gabinete (prova de valor na renovação); exportação dos dados
do cliente (reduz medo de aprisionamento); indicação/refer­ral entre gabinetes
(o canal mais barato que existe nesse mercado).

---

## 3. Quem compra — três canais, três produtos diferentes

O mesmo software vende de três formas. Confundi-las é o erro clássico.

| Canal | Quem decide | Ticket | Ciclo | Atrito |
|---|---|---|---|---|
| **Assessor** | O próprio assessor, muitas vezes do bolso | R$ 97/mês | dias | Baixo: cartão e pronto. Rotatividade alta — o assessor sai, a conta morre. |
| **Gabinete** | O vereador, com verba de gabinete | R$ 197/mês | semanas | Média: precisa nota fiscal e às vezes aval da Casa. |
| **Câmara** | Mesa Diretora / Secretaria Administrativa | R$ 1.000–3.000/mês | meses | Alta: processo formal. Mas cobre 19 gabinetes de uma vez e quase não churna. |

**O enquadramento legal favorece a venda institucional.** Contratação direta
por dispensa de licitação (Lei 14.133/2021, art. 75, II) tem teto atualizado
por decreto — na casa das dezenas de milhares de reais por ano. Um contrato de
R$ 2.000/mês (R$ 24 mil/ano) cabe folgado, o que significa **processo simples,
sem licitação**. Confirme o valor vigente do decreto e o rito com quem entende
de contratação pública antes de propor — o número muda todo ano.

**Recomendação: venda gabinete a gabinete primeiro, câmara depois.** O
contrato institucional é o prêmio, mas ninguém o assina sem casos de uso
dentro da própria Casa. Os 4 gabinetes beta são exatamente essa prova — desde
que virem referência declarada, não usuários silenciosos.

---

## 4. Sequência em quatro ondas

Cada onda tem um critério de saída. Não avance sem ele — avançar cedo em
venda pública queima a relação, e relação é o ativo aqui.

### Onda 0 — Fechar a torneira (2 a 3 semanas)

Resolver B1–B3 e B6. Sem público, sem anúncio. É trabalho de código.

- Assinatura recorrente de verdade (`preapproval` do Mercado Pago em vez de
  preferência avulsa), ou cobrança manual por boleto/PIX com controle de
  vencimento — o que for mais rápido de acertar.
- `checkLimite` passa a ler `planoAtivoEm` e a expirar plano vencido.
- Onboarding deixa de conceder BETA; o plano BETA vira concessão manual.
- Webhook com validação de assinatura e idempotência por `payment.id`.

**Saída:** um usuário novo consegue pagar, ser cobrado de novo no mês
seguinte, e perder o acesso se não pagar. Testado ponta a ponta em sandbox.

### Onda 1 — Converter o beta (3 a 4 semanas)

Os 4 gabinetes atuais são o teste mais barato de disposição a pagar que existe.

- Conversa individual com cada um: o que economiza, o que ainda irrita.
- Proposta de conversão com desconto de fundador vitalício (ex.: R$ 97 no
  plano Gabinete) em troca de **depoimento nominal e autorização de uso do
  nome**. O depoimento vale mais que o desconto.
- Quem não converter: entender por quê. É preço, é falta de valor, ou é que o
  assessor não decide? Cada resposta muda a onda seguinte.

**Saída:** ao menos 2 dos 4 pagando, com 2 depoimentos utilizáveis.
Se ninguém converter, **pare e reformule o produto** — não adianta escalar
uma coisa que quem usa de graça não quer pagar.

### Onda 2 — Guarujá inteira (4 a 6 semanas)

19 vereadores na Casa; 4 já usam. A abordagem é presencial e por indicação —
não é mercado de anúncio.

- Peça aos gabinetes convertidos a apresentação aos colegas. Em Câmara
  municipal, a recomendação de um vereador ao lado vale mais que qualquer copy.
- Demonstração de 15 minutos usando **as indicações reais do vereador
  abordado**, extraídas do SISCAM. Chegar sabendo que ele protocolou 287
  indicações em 2025, das quais 30% eram sobre um bairro específico, muda
  completamente a conversa.
- Material: one-pager em PDF, vídeo de 90s do fluxo, e a demo pública que já
  existe em `/demo`.

**Saída:** 8 a 10 gabinetes pagantes em Guarujá, e o primeiro contato formal
com a Mesa Diretora.

### Onda 3 — Segunda cidade + proposta institucional (2 a 3 meses)

Duas frentes em paralelo:

1. **Proposta de contrato para a Câmara de Guarujá**, com metade da Casa já
   usando. O argumento é a padronização do protocolo, não a economia.
2. **Uma segunda cidade da Baixada Santista** (Santos, São Vicente, Praia
   Grande, Cubatão). Aqui o corpus prova o seu valor: se o pipeline de coleta
   funcionar num SISCAM de outra Casa, o embarque é de dias, não de semanas.

**Saída:** um contrato institucional assinado, ou 10 gabinetes pagantes na
segunda cidade. Qualquer um dos dois valida a replicabilidade.

> **Antes da onda 3, confirme se a outra Câmara usa SISCAM.** O sistema é da
> SINO Informática e atende várias cidades, mas o padrão da ementa é de cada
> Casa. Se o padrão de Guarujá não valer em Santos, o custo de embarque muda
> de patamar — e a onda 3 precisa ser replanejada antes de começar, não no meio.

---

## 5. O que medir

Poucas métricas, todas acionáveis. Quatro delas já existem via `UsageLog`.

| Métrica | Onde | Para que serve |
|---|---|---|
| Indicações por gabinete por semana | `UsageLog` | Uso caindo é churn com 30 dias de antecedência |
| % de indicações editadas antes de exportar | `Indicacao` + feedback | Proxy direto de qualidade do texto |
| Taxa 👍/👎 | feedback | Já implementado, nunca olhado |
| Tempo do relato à exportação | precisa instrumentar | É o número que vende: "de 40 minutos para 4" |
| Conversão trial → pago | precisa instrumentar | O funil inteiro em um número |
| Custo de LLM por gabinete | precisa instrumentar (`usage` da API) | Confirma os 2% da seção 1 com dado real |

O quarto item é o mais importante e o único que ainda não é medido.
**Cronometre isso com os gabinetes beta antes da onda 1** — sem esse número,
a proposta comercial é adjetivo; com ele, é aritmética.

---

## 6. Riscos

| Risco | Probabilidade | Impacto | O que fazer |
|---|---|---|---|
| Ninguém do beta converte | Média | Alto | É sinal, não obstáculo. Descobrir se é preço ou valor antes de escalar. |
| Eleição municipal troca os gabinetes | Certa (2028) | Alto | Contrato com a Casa não depende de mandato. É outro argumento para a onda 3. |
| A Câmara constrói ou compra algo equivalente | Baixa | Alto | Velocidade e o corpus são a defesa. Um fornecedor genérico não tem 1.897 ementas da Casa. |
| SISCAM passa a exigir captcha na coleta | Média | Médio | O corpus já coletado não se perde. Reduz atualização, não invalida o produto. |
| Assessor sai e leva o conhecimento | Alta | Médio | Vender ao gabinete, não à pessoa. Conta vinculada ao tenant, não ao e-mail. |
| Um texto gerado sai errado e é protocolado | Média | Alto | Revisão humana é obrigatória por desenho — deixar isso explícito no contrato e na interface. |

---

## 7. A primeira coisa a fazer

Não é código. É **ligar para os quatro gabinetes beta e cronometrar** quanto
tempo eles levavam antes e levam agora para produzir uma indicação.

Esse número decide o preço, escreve o one-pager, e responde se a Onda 0 vale
o esforço. Tudo neste documento depende dele, e ele custa quatro telefonemas.
