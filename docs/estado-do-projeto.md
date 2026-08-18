# Estado do projeto — onde paramos

Atualizado em **18/08/2026**, no commit `f7e8e4e`.

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
| Geração de PDF | **Funcionando** — verificado chamando `/api/demo` em produção |
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

## Ferramentas de trabalho

| Comando | Para quê |
|---|---|
| `npx tsx scripts/gerar-indicacao.ts "relato"` | Ciclo completo → `.pdf`, `.html` e `.txt` |
| `npx tsx scripts/preview-layout.ts [texto.txt] [saida.pdf]` | Regera o PDF **sem gastar LLM** |
| `npx tsx scripts/preview-html.ts` | Exporta o HTML para inspeção |
| `node tools/preview-a4.mjs <html> <png>` | Renderiza como folha A4, **com o recorte que o PDF aplica** |
| `npm run verify:pdf` | Confere margens, páginas, fontes e tempo frio/quente |
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

**4. O deploy não aplica migrations.**
`npm run build` é só `prisma generate && next build`. Toda migration precisa ser
aplicada à mão, **antes** de o código que a usa chegar em produção.

**5. Os PDFs do SISCAM são digitalizações.**
Sem fonte embarcada, sem camada de texto (CCITTFax, ~200 DPI). Não servem como
referência de fidelidade — a referência é o documento que o gabinete gera.

---

## Pendências

Em ordem do que eu atacaria primeiro.

### 1. Tirar o GitHub do cold start do PDF (alta)

`resolverChromium()` tenta o binário embarcado e, se faltar, baixa um pack de
66 MB do GitHub. **Não se sabe por qual caminho está funcionando hoje** — dá para
descobrir nos logs da função: se aparecer `[pdf] binário local do Chromium
indisponível`, é o download.

Se for o download, cada cold start busca 66 MB num domínio de terceiro. O caminho
limpo é hospedar o pack (Vercel Blob, S3) e apontar `CHROMIUM_EXECUTABLE_PATH`
para ele — a variável já tem precedência no código.

Foi essa dependência que quebrou a geração de PDF em produção (URL apontava para
uma versão inexistente e sem sufixo de arquitetura).

### 2. Smoke test pós-deploy (alta)

Nada verifica o ramo serverless. Um teste que chame `/api/demo` no deploy e
confirme `application/pdf` teria pegado a quebra antes de você. É barato.

### 3. Vulnerabilidade no `@auth/core` (alta)

`npm audit` reporta crítica: bypass por homoglyph na normalização de e-mail. O
login é magic link por e-mail, então é o fluxo afetado. Não foi mexido porque
atualizar `next-auth` beta pede janela dedicada e teste do login.

### 4. Etapas 6, 7 e 8 do guia de PDF (média)

- **6 — diff visual:** a referência já está versionada; falta o script de
  comparação e o limiar como teste de regressão.
- **7 — preview WYSIWYG na tela:** hoje o app mostra o texto puro. O certo é um
  `<iframe>` com o **mesmo HTML** do PDF.
- **8 — DOCX a partir do `IndicacaoDoc`:** hoje o DOCX ainda monta o documento
  por conta própria. No DOCX pode-se citar as fontes originais pelo nome — só o
  PDF precisa das substitutas livres (ver [docs/fontes.md](fontes.md)).

### 5. Editor de template dentro do app (média)

`public/editor.html` são 1.078 linhas de HTML fora do React e do build. A tela de
Configurações não mostra nem permite editar o template. Foi um dos pontos que
você notou faltando na interface.

### 6. Migrations perdidas (baixa, informativo)

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
