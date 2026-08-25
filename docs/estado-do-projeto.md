# Estado do projeto — onde paramos

Atualizado em **25/08/2026**.

Documento de retomada: o que existe hoje, por que está assim, o que quebrou no
caminho e o que ficou pendente. Leia junto com o [README](../README.md) (como
rodar) e o [CLAUDE.md](../CLAUDE.md) (regras ao alterar o projeto).

---

## O que o sistema faz hoje, de ponta a ponta

```
relato em texto livre
  → extração (modelo barato)        lib/extract.ts
  → validação Zod + normalização    lib/validator.ts · lib/normalizer.ts
  → enriquecimento de endereço      lib/geocoder.ts        (não bloqueia)
  → texto formal ‖ ementa           lib/generate.ts ‖ lib/ementa.ts (em paralelo)
  → layout do gabinete              lib/layouts/
  → PDF A4 pronto para imprimir     lib/pdf.ts
```

Funciona em produção (`usedipo.com.br`). O assessor gera, revisa, imprime e
protocola sem passar pelo Word.

**A ementa** é o campo "Assunto" do protocolo. Segue a fórmula fixa da Câmara —
levantada em [docs/siscam-camara-guaruja.md](siscam-camara-guaruja.md) — e tem
botão de copiar na tela de geração e no histórico.

---

## Estado de produção

| Item | Situação |
|---|---|
| Deploy | Vercel, `usedipo.com.br` |
| Banco | PostgreSQL no Railway |
| Migrations | Em dia (`prisma migrate status` limpo) |
| Geração de PDF | **Funcionando**, e desde 25/08 com o Chromium vindo do bundle |
| Testes | 184 passando |
| CI | GitHub Actions verde |

### Tenants e templates

Quatro tenants. Dois receberam o template oficial do Márcio e o
`vereadorSlug = 'marcio_pet'`:

| Tenant | Template | Slug |
|---|---|---|
| Dipo Admin (`olavobernardo@`) | Oficial — Márcio do Pet Shop | `marcio_pet` |
| Gabinete do Vereador Márcio (`carlos07.m3@`) | Oficial — Márcio do Pet Shop | `marcio_pet` |
| Gabinete do Vereador Marcio do Pet (`emetiga@`) | — | `outro` |
| Camila Vitoria (`camila_vitoria1304@`) | — | `outro` |

Para ativar um novo gabinete:

```bash
npx tsx scripts/aplicar-template.ts <tenantId>              # dry-run
npx tsx scripts/aplicar-template.ts <tenantId> --executar
```

> **O `vereadorSlug` importa mais do que parece.** Todos os tenants estavam em
> `'outro'`, o que significa que o perfil dedicado de cada vereador — prompt
> específico e few-shot — **nunca foi usado**. O texto saía no estilo genérico.
> Ao corrigir, o texto passa a sair no estilo do gabinete.

---

## O layout do PDF

`lib/layouts/brasao_esquerda` reproduz o documento do gabinete. **Nenhuma medida
foi estimada** — todas saíram do `.docx` e do `.pdf` reais, versionados em
`tests/fixtures/referencia/`. A tabela completa está em
[docs/especificacao-gabinete-marcio.md](especificacao-gabinete-marcio.md).

Pontos que reproduzem o original **de propósito**, mesmo parecendo erro:

- o preâmbulo é justificado, mas o parágrafo `Indico à Mesa...` fica à esquerda;
- a linha de assinatura usa `border-top` (no Word são underscores literais) —
  decisão do gabinete.

O layout novo **só entra quando o template tem `layoutId`**. Sem ele, o gerador
segue no HTML legado — foi assim que os outros gabinetes ficaram protegidos
durante todo o desenvolvimento.

### Ajustar a posição do brasão

É um número só, `deslocEsq` em `lib/layouts/brasao-esquerda.ts`. A margem da
página acompanha sozinha (`SANGRIA` deriva dele), então mover o brasão não volta
a cortá-lo. Confira depois com:

```bash
npx tsx scripts/preview-html.ts && node tools/preview-a4.mjs tmp/preview-marcio.html tmp/preview.png
```

O preview reporta a distância do brasão até a borda e avisa se algo sai da folha.

---

## Como a geração de PDF é verificada

Três camadas, porque nenhuma delas cobre o que a seguinte cobre.

| Camada | Onde roda | O que prova |
|---|---|---|
| 184 testes | máquina e CI | a lógica do gerador, pelo ramo do Playwright |
| `verify:bundle` | CI, depois do build | que o Chromium viaja no bundle de cada rota que gera PDF |
| Smoke pós-deploy | GitHub Actions, após o deploy | que o ramo serverless lança o Chromium e devolve um PDF |

A camada do meio existe porque o build **passa** com o Chromium fora do bundle:
a rota responde 200 e baixa o pack remoto. A de baixo existe porque nada que
roda na máquina passa pelo ramo serverless.

E as duas de baixo não se substituem. O smoke test bate em `/api/health/pdf`,
que é uma função com bundle próprio — o verde dela não diz nada sobre o bundle
de `/api/pdf/[id]`. Quem cobre isso é o `verify:bundle`.

### Ligar o smoke test

Ele fica inerte até o token existir nos dois lados:

1. Gere um valor: `openssl rand -hex 32`
2. Vercel → Settings → Environment Variables → `PDF_HEALTH_TOKEN` (Production)
3. GitHub → Settings → Secrets and variables → Actions → `PDF_HEALTH_TOKEN`

Sem o passo 2 a rota responde 404 e o smoke test reprova dizendo exatamente
isso. Para rodar à mão contra produção:

```bash
SMOKE_URL=https://usedipo.com.br PDF_HEALTH_TOKEN=<token> npm run smoke
```

---

## Ferramentas de trabalho

| Comando | Para quê |
|---|---|
| `npx tsx scripts/gerar-indicacao.ts "relato"` | Ciclo completo → `.pdf`, `.html` e `.txt` |
| `npx tsx scripts/preview-layout.ts [texto.txt] [saida.pdf]` | Regera o PDF **sem gastar LLM** |
| `npx tsx scripts/preview-html.ts` | Exporta o HTML para inspeção |
| `node tools/preview-a4.mjs <html> <png>` | Renderiza como folha A4, **com o recorte que o PDF aplica** |
| `npm run verify:pdf` | Confere margens, páginas, fontes e tempo frio/quente |
| `npm run verify:bundle` | Confere que o Chromium vai no bundle das rotas de PDF (roda no CI) |
| `npm run smoke` | Smoke test contra um deploy; pede `SMOKE_URL` e `PDF_HEALTH_TOKEN` |
| `npx tsx scripts/teste-tenant.ts <tenantId>` | Gera pelo caminho de produção (lê o template do banco) |
| `npx tsx scripts/reproduz-pdf.ts` | Reproduz `/api/pdf` com a última indicação real |
| `npx tsx scripts/aplicar-template.ts <tenantId>` | Ativa o template de um gabinete |

---

## Armadilhas que já custaram caro

Cada uma destas custou um ciclo de depuração. Estão aqui para não custar de novo.

**1. Margem do PDF vive no `@page`, não no `page.pdf()`.**
Medido: quando `@page { margin }` existe, o Chromium **ignora** o `margin` da
API. Não somam. Trocar para `@page { margin: 0 }` deixando só no `page.pdf()`
**zera as margens** e cola o texto na borda.

**2. O preview precisa recortar a área imprimível.**
O Chromium corta o que ultrapassa a `@page`. Um preview sem `overflow:hidden` e
sem as margens aplicadas mostra o documento inteiro enquanto o PDF sai cortado —
foi assim que o brasão cortado passou. `tools/preview-a4.mjs` já faz isso certo.

**3. Os testes locais não cobrem o caminho de produção.**
`lib/pdf.ts` tem dois ramos: serverless (`@sparticuz/chromium`) e local
(`playwright`). Todo teste local exercita **só o segundo**. Foi por isso que o
PDF quebrado em produção sobreviveu a 184 testes e a um CI verde.

**4. As chaves do `outputFileTracingIncludes` são globs, não caminhos.**
`'/api/pdf/[id]'` parece o nome da rota, mas `[id]` ali é uma classe de
caracteres: casa com `/api/pdf/i` e `/api/pdf/d`, nunca com a rota dinâmica.
A declaração não pegava, o Chromium ficava fora do bundle e a produção baixava
66MB do GitHub a cada cold start — silenciosamente, porque `lib/pdf.ts` cai na
reserva e responde 200. Use `'/api/pdf/**'`. Confira sempre no manifesto
(`.next/server/app/<rota>/route.js.nft.json`), nunca na saída do build: o build
passa dos dois jeitos. É o que `npm run verify:bundle` faz.

**5. O deploy não aplica migrations.**
`npm run build` é só `prisma generate && next build`. Toda migration precisa ser
aplicada à mão, **antes** de o código que a usa chegar em produção.

**6. `browser.isConnected()` mente.**
Ele devolve `true` para um browser que já não aceita `newPage()`. Com o browser
reaproveitado entre invocações, uma instância quente podia ficar com um browser
morto em cache e responder 500 até a Vercel reciclá-la — metade das requisições,
alternando entre as instâncias. Quem decide se o browser serve é o `newPage()`;
por isso ele mora dentro do `try` e existe uma retentativa com browser novo.
Descoberto pelo smoke test na primeira vez que rodou duas vezes seguidas.

**7. Os PDFs do SISCAM são digitalizações.**
Sem fonte embarcada, sem camada de texto (CCITTFax, ~200 DPI). Não servem como
referência de fidelidade — a referência é o documento que o gabinete gera.

---

## Pendências

Em ordem do que eu atacaria primeiro.

### 1. Vulnerabilidade no `@auth/core` (alta)

`npm audit` reporta crítica: bypass por homoglyph na normalização de e-mail. O
login é magic link por e-mail, então é o fluxo afetado. Não foi mexido porque
atualizar `next-auth` beta pede janela dedicada e teste do login.

### 2. Etapas 6, 7 e 8 do guia de PDF (média)

- **6 — diff visual:** a referência já está versionada; falta o script de
  comparação e o limiar como teste de regressão.
- **7 — preview WYSIWYG na tela:** hoje o app mostra o texto puro. O certo é um
  `<iframe>` com o **mesmo HTML** do PDF.
- **8 — DOCX a partir do `IndicacaoDoc`:** hoje o DOCX ainda monta o documento
  por conta própria. No DOCX pode-se citar as fontes originais pelo nome — só o
  PDF precisa das substitutas livres (ver [docs/fontes.md](fontes.md)).

### 3. Editor de template dentro do app (média)

`public/editor.html` são 1.078 linhas de HTML fora do React e do build. A tela de
Configurações não mostra nem permite editar o template. Foi um dos pontos que
você notou faltando na interface.

### 4. Migrations perdidas (baixa, informativo)

O banco tem 7 migrations registradas que não existem no repositório — criadas
quando o `.gitignore` ainda escondia `prisma/migrations/`. A baseline `0_init`
cobre esse estado e está marcada como aplicada. **Não tente recriá-las**: o
checksum não bateria.

---

## Decisões em aberto

- **Parágrafo de transição:** o documento de referência tem *"Diante disso,
  apresento a esta Casa de Leis a seguinte:"* antes do título. A IA nem sempre
  gera. Se o gabinete usa sempre, vale fixar no perfil do Márcio.
- **Logo do partido:** o documento traz **Cidadania 23**; o SISCAM lista o Márcio
  como **PTB**. Mantido o do documento — confirmar qual vale.
- **Ementa:** gerada e copiável, mas ainda não usada em nenhum outro lugar.
  Poderia ir no DOCX ou numa futura exportação em lote.
