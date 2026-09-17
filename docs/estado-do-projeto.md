# Estado do projeto — onde paramos

Atualizado em **17/09/2026**, madrugada.

Documento de retomada: o que existe hoje, por que está assim, o que quebrou no
caminho e o que ficou pendente. Leia junto com o [README](../README.md) (como
rodar) e o [CLAUDE.md](../CLAUDE.md) (regras ao alterar o projeto).

> Este arquivo é a memória entre sessões e entre máquinas. Quem encerra uma
> sessão atualiza ele e dá `push`. O protocolo está no
> [CLAUDE.md](../CLAUDE.md#protocolo-de-sessão).

---

## O que mudou desde 25/08

A versão anterior deste documento era de 25/08 às 15h18 e ficou para trás no
mesmo dia. O que aconteceu depois:

| Data | Mudança |
| --- | --- |
| 25/08 | **Vulnerabilidade do `@auth/core` corrigida** (PR #7). Era a pendência nº 1 daqui — está resolvida, `@auth/core` em 0.41.3 |
| 25/08 | Plano BETA passa a exigir e-mail autorizado (PR #5) |
| 25/08 | Checkout suspenso até existir cobrança recorrente de verdade (PR #6) |
| 25/08 | Indicação registra qual assessor a produziu (PR #8) |
| 25/08 | Planos deixam de prometer o que o produto não entrega (PR #9) |
| 01/09 | **Título e endereço deixam de sumir no histórico** (`32079c5`) |
| 15/09 | **PDF volta a sair em produção**: contexto único para o browser não cair entre gerações (PR #10) |
| 15/09 | Documento de estado atualizado e protocolo de sessão fixado no `CLAUDE.md` |
| 16/09 | **Modelos atualizados para a geração Claude 5** e o adaptador ajustado às três mudanças de API que vieram junto |
| 16/09 | Descoberto que **produção roda na OpenAI**, e que cinco segredos estão gravados como Config na Vercel |
| 16/09 | **Chaves da OpenAI e do Resend rotacionadas**, com permissão mínima e gravadas como Secret |
| 16/09 | **AUTH_SECRET rotacionado** e gravado como Secret; NEXTAUTH_SECRET apagado |
| 16/09 | Numeração do histórico deixa de mudar conforme o filtro |
| 17/09 | **Ajuste vira versão da mesma indicação**, com a instrução guardada — verificado em produção |

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
| Banco | PostgreSQL 17 no Railway (projeto `scintillating-wonder`) |
| Backup do banco | Diário e cifrado desde 01/09 ([dipo-backups](https://github.com/OlavoBe/dipo-backups)) |
| Migrations | Em dia (`prisma migrate status` limpo) |
| Geração de PDF | **Funcionando**, e desde 25/08 com o Chromium vindo do bundle |
| Testes | 202 passando em 18 arquivos, itest run (aferido em 16/09) |
| CI | GitHub Actions verde |
| LLM | **OpenAI** — gpt-4o na geração, gpt-4o-mini na extração |
| Uso | 154 indicações geradas, 19 delas num único dia |
| Visibilidade do repo | **Público** — ver pendências |

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
| 202 testes | máquina e CI | a lógica do gerador, pelo ramo do Playwright |
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

**8. `truncate` deixa a coluna encolher até zero.**
Num flex, `overflow:hidden` faz o `min-width:auto` resolver para zero. No card do
histórico, a fileira de botões era `shrink-0` e ocupava 514px fixos, então entre
768px e ~920px de viewport o título e o endereço ficavam com **largura 0** —
presentes no DOM, invisíveis na tela. O sintoma parecia dado faltando e não era.
Corrigido em `32079c5`: `flex-wrap` na linha, `min-w-[14rem]` no conteúdo e
`ml-auto` nas ações. **Ao acrescentar botão num card, confira numa janela
estreita.**

**9. Em `--single-process`, fechar um contexto derruba o browser inteiro.**
O `@sparticuz/chromium` roda assim em produção, e `browser.newPage()` cria um
contexto por página e o fecha junto com ela — então cada PDF matava o browser no
`page.close()`. Em série isso ficava escondido, porque a retentativa do
`newPage()` relançava o Chromium a cada geração. Com duas gerações simultâneas
na mesma instância (o botão "Imprimir" abre o PDF numa aba que costuma disparar
mais de uma requisição), a primeira a terminar derrubava o browser da outra no
meio do `setContent()`, e a rota respondia 500. Corrigido em 15/09 com um
contexto único (`getContexto()`). **`PDF_SIMULA_SERVERLESS=1` liga as flags de
processo da produção no ramo local** — sem isso a máquina não reproduz o
defeito. Medido: antes 7 de 9 gerações, depois 9 de 9, com zero relançamentos.

**10. A geração Claude 5 removeu `temperature` e ligou o raciocínio.**
Três coisas quebram ao trocar só o nome do modelo: `temperature` passa a devolver
HTTP 400; o primeiro bloco da resposta vira `thinking` com texto vazio, então
`content[0].text` devolve string vazia sem erro nenhum; e o raciocínio consome o
mesmo orçamento de `max_tokens`, o que cortaria a indicação no meio com os 2048
que usávamos. O `lib/llm.ts` trata as três — ver "Regra de Modelo LLM" no
[CLAUDE.md](../CLAUDE.md). Os prompts de extração e ementa pediam
`temperature: 0`; a consistência agora depende do prompt, não do parâmetro.

**11. Rodar migration desta máquina esbarra em quatro coisas.** Todas do
ambiente, nenhuma do projeto, e todas custaram uma tentativa em 17/09: o PATH do
terminal não tem o Node (o app foi aberto antes da instalação); a política de
execução do PowerShell bloqueia o `npx.ps1`; o `npx` baixa o Prisma da internet
em vez de usar o local; e PowerShell e cmd têm sintaxes diferentes para variável
de ambiente. O caminho que funciona é criar o `.env` (já ignorado pelo git) com a
`DATABASE_URL` e chamar o binário local:
`"C:\Program Files\nodejs\node.exe" node_modules\prisma\build\index.js migrate deploy`.

**12. Quando o modelo erra o mesmo campo de três formas, o problema é o dado.**
Investigado em 17/09, com seis gerações reais em produção. Vale como método.

O corpo da indicação saía com endereço errado, depois sem endereço, depois com
um pedido de endereço ao usuário — enquanto a **ementa saía sempre correta**.
Essa assimetria era a pista: os dois leem os mesmos dados extraídos.

**Causa raiz:** `buildUserPromptGeral` montava o pedido **sem nenhuma linha de
endereço** — só categoria, tema, solicitante, descrição, providências e
observações. Esse caminho atende tudo que não é `servico_urbano` nem
`seguranca_publica`, e "poda de árvore" cai em `meio_ambiente`. O modelo nunca
recebeu o endereço nessas categorias. A ementa funcionava porque
`lib/ementa.ts` monta a localização por conta própria.

Três tentativas de conserto por prompt falharam antes disso, e cada uma ensina:

1. "Nunca invente endereço" → parou de inventar e passou a **omitir**.
   Proibir sem obrigar empurra para a omissão.
2. "O endereço é obrigatório no corpo" → continuou omitindo, porque a fórmula
   da `variacao_2` não tinha lugar para endereço. **Fórmula vence regra.**
3. Regra mais dura → o modelo **parou de gerar o documento** e devolveu
   "preciso do endereço completo, por favor forneça". Toda obrigação precisa
   dizer o que fazer quando o dado não existe, senão o modelo inventa a saída —
   e a que ele inventa costuma ser pior que a omissão.

Por isso o prompt tem hoje a garantia: **sempre devolva a indicação pronta,
nunca escreva mensagem ao usuário**. Um gerador de documento não conversa.

**Estado: resolvido e verificado em produção** (17/09, 02h30). A mesma poda de
árvore que falhava saiu com o endereço nos três lugares — ementa, justificativa
("moradores da Rua Doutor Teste, nº 100, Vila Santa Rosa, Guarujá/SP, que
relataram...") e providência numerada. Nada inventado, nada omitido, sem
mensagem ao usuário.

**Também corrigido de passagem:** o exemplo genérico de tapa-buraco abria com
"moradores da localidade que relataram [problema] ... na Rua X" — endereço no
fim, depois do relato —, agora segue o padrão dos exemplos do gabinete, com o
endereço antes do relato. E o typo "Foramos procurados" foi corrigido nos seis
arquivos de exemplo; um teste do `doc-parser` chegava a exigir o typo.
**13. `429 insufficient_quota` não é erro de chave inválida.**
O código é `credit_balance_exhausted` e a mensagem fala em créditos: a chave está
correta, quem está sem saldo é a **organização** dona dela. Aconteceu ao trocar a
chave por uma criada em outra organização da mesma conta — a nova era válida, só
que apontava para um lugar sem crédito. Ao rotacionar, confira a organização e o
projeto no seletor do topo do painel da OpenAI, não só o nome da chave.

---

## Pendências

Em ordem do que eu atacaria primeiro.

### 1. Falta um segredo para rotacionar: `DATABASE_URL` (alta)

Cinco variáveis estavam no tipo **Config** desde 18/03. Valor em Config **pode
ser revelado no painel** por quem tem acesso ao projeto; em Secret é de escrita
apenas — depois de salvo ninguém mais lê, nem você.

| Variável | Situação |
| --- | --- |
| `LLM_API_KEY` | rotacionada + Secret (16/09) |
| `RESEND_API_KEY` | rotacionada + Secret (16/09) |
| `AUTH_SECRET` | **rotacionado + Secret (16/09)** |
| `NEXTAUTH_SECRET` | **apagado** — era fallback morto, ver abaixo |
| `DATABASE_URL` | **pendente**, e é a mais trabalhosa |

Sobre o `NEXTAUTH_SECRET`: o `auth.ts` lê `AUTH_SECRET ?? NEXTAUTH_SECRET`, então
o segundo nunca era usado em produção — só guardava uma cópia do segredo antigo,
legível no painel. Foi apagado. Se algum dia o `AUTH_SECRET` sumir, o login para
de funcionar em vez de cair silenciosamente num segredo velho, o que é melhor.

**Por que a rotação confirmou a urgência:** ao abrir a edição do `AUTH_SECRET`
para trocá-lo, a Vercel exibiu o valor antigo em texto puro na tela. Dois
cliques. Era exatamente o risco descrito nesta pendência, demonstrado.

#### O que falta, e por que exige janela própria

O `DATABASE_URL` não é uma troca, é uma coreografia em três lugares:

1. rotacionar a senha do Postgres no Railway (o serviço reinicia);
2. atualizar a variável na Vercel e **redeployar**;
3. atualizar `BACKUP_INDICACOES_URL` no serviço `dipo-backups`, que guarda a
   mesma URL como **valor literal** — referência `${{...}}` não cruza projetos.

Entre o passo 1 e o 3 o site fica fora do ar e o backup falha. Não comece sem
tempo de terminar: parar no meio deixa produção quebrada, e é pior que o risco
que a rotação corrige.
### 2. Chaves da OpenAI e do Resend — rotacionadas em 16/09

Registro, não pendência. As duas eram `Full access` / `All`, sem expiração.
Foram substituídas por chaves **Restricted**: a da OpenAI com acesso só a
`/v1/chat/completions`, a do Resend só com *Sending access* — exatamente o que o
código usa, nada além. As antigas foram revogadas, inclusive **a chave da OpenAI
exposta em conversa desde agosto**, que era risco aberto desde a primeira sessão.

Como está a conta da OpenAI hoje:

| Chave | Sistema | Onde mora | Permissão |
| --- | --- | --- | --- |
| `Dipo Vercel producao` | Indicações | Vercel, `LLM_API_KEY` | Chat completions |
| `Dipo Agenda Railway` | Agenda | Railway, `OPENAI_API_KEY` | Chat completions |

As duas vivem na **mesma organização e projeto** — Personal / *Indicações geradas
por IA* — e dividem o mesmo saldo. Se o crédito acabar, os dois sistemas param
juntos. O auto-reload está **desligado**.

### 3. Decidido: produção segue na OpenAI

Não é pendência, é registro de decisão (16/09). O gabinete paga a chave da
OpenAI, então `gpt-4o` na geração e `gpt-4o-mini` na extração continuam. O
suporte a Claude no adaptador fica disponível, atualizado para a geração 5, para
o dia em que fizer sentido trocar — ver o [CLAUDE.md](../CLAUDE.md).

Sobra uma limpeza pequena: apagar a variável `LLM_MODEL=gpt-4o-mini` da Vercel,
que nenhuma linha do código lê e engana quem for trocar modelo.
### 4. "Regenerar com ajuste" — implementado em 17/09

O ajuste passou a produzir **uma nova versão da mesma indicação**. Verificado em
produção: uma geração seguida de um ajuste produziu **um único card** no
histórico (`#175`), com o endereço já corrigido. Antes seriam dois registros,
duas posições no total e duas cotas do TRIAL.

A tabela `IndicacaoVersao` guarda cada versão com a instrução que a gerou. A
versão 1 é gravada também na geração normal — sem isso, a primeira versão de
cada indicação seria a única impossível de consultar.

Proteção que vale conhecer antes de mexer: o `findFirst` do ajuste filtra por
`tenantId`. O `ajustarId` vem do cliente; sem esse filtro, um id forjado editaria
a indicação de outro gabinete. Há teste cobrindo exatamente isso.

### 4b. O botão de ajuste está escondido (alta, interface)

Descoberto ao testar o item acima. Na tela de resultado existem dois caminhos:

| Elemento | O que faz | Peso visual |
| --- | --- | --- |
| **Nova indicação** | limpa tudo e recomeça — cria registro novo | botão, destacado |
| **Ajustar indicação** | abre a caixa de instrução do ajuste | link pequeno com seta |

O dono do produto, sabendo exatamente o que a funcionalidade faz, usou o
primeiro quando queria o segundo. O assessor vai fazer o mesmo — e continuará
criando indicações novas em vez de ajustar, que é justamente o comportamento que
o versionamento veio corrigir.

O conserto no servidor não resolve sozinho: **enquanto o ajuste for o caminho
menos visível, ele vai continuar sendo o menos usado.** Vale inverter o peso dos
dois, ou abrir a caixa de ajuste por padrão.
### 5. Numeração do histórico — resolvida em 16/09

Registro. O número saía de `total - offset - i`, com o total **já filtrado**: a
mesma indicação aparecia como #145 em "Todos" e como #3 em "Últimos 7 dias".
Como é assim que elas são referidas na conversa, o número mudar conforme o
filtro engana quem procura.

Agora é a **posição absoluta dentro do gabinete** — quantas indicações existem
até ela, inclusive. Não depende de filtro nem de página, e sem filtro o
resultado é idêntico ao de antes: nenhuma indicação mudou de número.

Custa N contagens por página (20) em vez de uma conta. Com 154 registros é
irrelevante. Se um dia incomodar, o caminho é guardar o número numa coluna na
criação — **o que exige migration aplicada à mão**, porque o deploy daqui não
aplica (armadilha 5). Não vale a troca hoje.
### 6. Repositório público (média, decisão)

O `DipoV1` está **público** no GitHub. O histórico completo — 74 commits — foi
varrido em 01/09 procurando chaves de OpenAI, Anthropic, AWS, Google e GitHub,
tokens e strings de conexão: **nada vazou**, só marcadores no `.env.example` e
credenciais descartáveis de CI (`postgres:postgres@localhost`). Ainda assim é
uma decisão a tomar de propósito, não por inércia. O `dipoagenda` foi tornado
privado em 01/09.

### 7. Rota morta `/api/historico` (baixa)

A página busca `/api/indicacoes`; nenhuma referência a `/api/historico` existe
no projeto. A rota antiga continua lá, com formato diferente e sem paginação —
armadilha para quem for mexer depois.

### 8. Etapas 6, 7 e 8 do guia de PDF (média)

- **6 — diff visual:** a referência já está versionada; falta o script de
  comparação e o limiar como teste de regressão.
- **7 — preview WYSIWYG na tela:** hoje o app mostra o texto puro. O certo é um
  `<iframe>` com o **mesmo HTML** do PDF.
- **8 — DOCX a partir do `IndicacaoDoc`:** hoje o DOCX ainda monta o documento
  por conta própria. No DOCX pode-se citar as fontes originais pelo nome — só o
  PDF precisa das substitutas livres (ver [docs/fontes.md](fontes.md)).

### 9. Editor de template dentro do app (média)

`public/editor.html` são 1.078 linhas de HTML fora do React e do build. A tela de
Configurações não mostra nem permite editar o template. Foi um dos pontos que
você notou faltando na interface.

### 10. Endereço público do Postgres (informativo, não é para "fechar")

O banco atende em `crossover.proxy.rlwy.net`. **Fechar derruba o site**: o app
roda na Vercel, fora da rede do Railway, e só alcança o banco por esse endereço
— e desde 01/09 o backup também depende dele. As saídas reais são rotacionar a
senha, mover o banco para o mesmo projeto do backup, ou mover o app para o
Railway. Não tratar como "item de segurança pendente" sem escolher uma delas.

### 11. Branch `chore/openai-e2e-corpus` sem mesclar (baixa)

Parada em 13/08, 5 commits: coleta de 1.452 PDFs do SISCAM, testes E2E no
GitHub Actions e limpeza de tenants com backup obrigatório. Única branch nunca
mesclada — decidir se entra ou se some.

### 12. Migrations perdidas (baixa, informativo)

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
