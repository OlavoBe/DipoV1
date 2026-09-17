# Guia do Projeto — Dipo Indicações (DipoV1)

Next.js 16 (App Router) · TypeScript · Prisma + PostgreSQL (Railway) ·
NextAuth v5 beta (magic link via Resend) · PDF por Playwright · DOCX pela lib
`docx` · deploy na Vercel. O resto do stack está no `package.json`.

Como o projeto funciona hoje e onde parou: [docs/estado-do-projeto.md](docs/estado-do-projeto.md).

---

## Regras para a IA (Claude Code)

- **Nunca modificar `.env`** — contém as configurações reais de produção.
  Variáveis de ambiente para testes vão sempre em `.env.local`.
- **Nunca remover os arquivos de test-login** — eles são inócuos em produção
  e são necessários para o ciclo de desenvolvimento.
- **Ao sugerir testes**, sempre orientar o uso do fluxo `/test-login` em vez
  de instruir o usuário a receber magic links.
- **Ao criar novas funcionalidades com planos**, sempre testar com as contas
  de teste pré-definidas (uma por plano).
- **Migrations:** usar `prisma migrate deploy` (não `migrate dev`) pois o
  ambiente pode ser não-interativo. Criar o arquivo SQL da migration manualmente
  em `prisma/migrations/<timestamp>_<nome>/migration.sql` quando necessário.
- **Nunca editar migrations já aplicadas** (`0_init` e as `20260413_*`) — o Prisma
  guarda o checksum e falha com "migration was modified after it was applied".
  Para corrigir algo, criar uma migration nova.
- **O deploy NÃO aplica migrations.** `npm run build` é só `prisma generate &&
  next build` (a Vercel não alcança o Railway no build). Ao adicionar um campo
  ao schema, a migration precisa ser aplicada à mão **antes** de o código que
  usa o campo chegar a produção — senão a rota grava numa coluna inexistente e
  quebra. Confira com `npx prisma migrate status` antes e depois.
- **Isolamento por tenant:** toda query que lê dados de um gabinete precisa filtrar
  por `tenantId`. Nunca usar `...(tenantId ? { tenantId } : {})` — isso remove o
  filtro em vez de barrar o acesso; retornar `403` quando não houver tenant.
  `getTemplate()` sem `tenantId` devolve defaults neutros e não toca o banco.
- **`DEFAULT_SETTINGS` (lib/template.ts) é neutro** — não colocar nome, gabinete ou
  e-mail de vereador ali. Esses dados vêm do tenant (perfil em `lib/vereadores.ts`
  ou onboarding).
- **Margens do PDF vivem no `@page` do CSS, não no `page.pdf()`.** Medido no
  Chromium do Playwright: quando `@page { margin }` está declarado, o `margin`
  passado ao `page.pdf()` é **ignorado** — não somam. Trocar para
  `@page { margin: 0 }` deixando a margem só no `page.pdf()` **zera as margens**
  e cola o texto na borda. Ao mexer nisso, rode `npm run verify:pdf`.
- **Não usar `git add -A`** — adicionar arquivos específicos para evitar
  commitar `.env.local` acidentalmente.


- **O preview de layout precisa recortar a área imprimível.** O Chromium corta
  o que ultrapassa a `@page`. Um preview sem `overflow:hidden` e sem as margens
  aplicadas mostra o documento inteiro enquanto o PDF sai cortado — foi assim
  que um brasão cortado passou despercebido. Use `tools/preview-a4.mjs`, que já
  reproduz o recorte e reporta a distância do brasão até a borda.
- **Os testes locais NÃO cobrem o caminho de produção do PDF.** `lib/pdf.ts` tem
  dois ramos: serverless (`@sparticuz/chromium`) e local (`playwright`). Tudo o
  que roda na máquina exercita só o segundo. Um PDF quebrado em produção já
  sobreviveu a 184 testes e a um CI verde. Ao mexer no ramo serverless, rode o
  smoke test contra o deploy (`npm run smoke`, ver docs/estado-do-projeto.md).
- **As chaves do `outputFileTracingIncludes` são globs.** `'/api/pdf/[id]'`
  parece o nome da rota, mas `[id]` é classe de caracteres e nunca casa com ela
  — o Chromium ficava fora do bundle e a produção baixava 66MB do GitHub a cada
  cold start, respondendo 200 o tempo todo. Use `'/api/pdf/**'` e confira no
  manifesto (`.next/server/app/<rota>/route.js.nft.json`), não na saída do
  build: o build passa dos dois jeitos. `npm run verify:bundle` faz isso e roda
  no CI.
- **Rotas com o mesmo `maxDuration` viram uma lambda só.** Valores diferentes
  viram lambdas diferentes, e cada uma leva a sua cópia dos 64MB do Chromium.
  Foi assim que o Functions Storage estourou. As rotas que geram PDF precisam
  declarar o mesmo valor — `npm run verify:bundle` reprova se divergirem.
- **Ao verificar uma correção, verifique pela rota que o usuário usa.** A
  geração de PDF foi dada como consertada depois de um teste por `/api/demo` —
  a única rota que estava certa. A rota real (`/api/pdf/[id]`) seguiu quebrada.
- **Layout novo só entra com `layoutId` no template.** Sem ele o gerador segue
  no HTML legado. É o que protege os gabinetes que ainda não foram calibrados —
  não remova essa condição.
- **Antes de apagar ou sobrescrever dados**, liste o que existe e mostre ao
  usuário. Um pedido para "apagar os outros templates" pode alcançar gabinetes
  que ele não tinha em mente. `scripts/aplicar-template.ts` faz dry-run por
  padrão — siga esse padrão em scripts que escrevem em produção.
- **Para testar login, use o fluxo `/test-login`** em vez de mandar o usuário
  receber magic link. A skill `test-login` tem o passo a passo.
- **Nunca remover os arquivos de test-login** (`app/test-login/page.tsx` e
  `app/api/test-login/route.ts`) — são inócuos em produção e necessários para o
  ciclo de desenvolvimento.

---

## Protocolo de sessão

Este projeto é tocado de três computadores: o do trabalho, o de casa e o
notebook. **O git é a única memória compartilhada entre eles.** Uma sessão que
não escreve no repositório não existe para as outras máquinas.

### Ao começar

1. `git pull` antes de qualquer coisa. Sem isso você trabalha em cima de uma
   versão velha e cria conflito.
2. Leia `docs/estado-do-projeto.md`. Ele é a fonte da verdade sobre onde paramos,
   e vale mais que a lembrança de quem está pedindo.
3. Se o documento estiver com data antiga e o repositório tiver commits mais
   novos que ele, desconfie: alguém encerrou sem atualizar. Já aconteceu — o
   documento ficou três semanas dizendo que uma vulnerabilidade estava aberta
   depois de ela ter sido corrigida.

### Ao encerrar, sempre

1. **Atualize `docs/estado-do-projeto.md`:**
   - a data no topo;
   - o que mudou nesta sessão e por quê;
   - o que quebrou e como foi contornado — inclusive o que não deu certo;
   - a lista de pendências, reordenada, com o que entrou e o que saiu.
2. **Commit e push.** Documento atualizado que ficou na máquina não serve para
   nada.
3. **Atualize a página de estado** — o resumo dos dois sistemas que se lê sem
   abrir o editor: <https://claude.ai/artifact/XoCGgChfsG6hcf1RJVhRoy>. O
   repositório é a fonte da verdade; a página é por onde ela é lida.

Isso vale **mesmo quando a sessão não mudou código**. "Verifiquei X e está
certo", "o item 3 já estava resolvido", "tentei Y e não funcionou por Z" são
informações que poupam a próxima sessão — em geral valem mais que o código.

### Quando a sessão mexeu nos dois sistemas

O Dipo são três repositórios: este, o `dipoagenda` (bot de WhatsApp) e o
`dipo-backups`. Cada um tem seu documento de estado, e cada um precisa do seu
commit. O que atravessa os dois sistemas — infraestrutura, riscos de segurança,
decisões de produto — vai no documento do sistema afetado, não só num deles.

### Num computador novo

O `CLAUDE.md` da pasta `Dipo Eco` (acima dos repositórios) não está em git —
nenhum repositório contém a pasta pai. Ele é recriado a partir de
[docs/claude-raiz.md](docs/claude-raiz.md): copie o conteúdo para
`<pasta>/Dipo Eco/CLAUDE.md`. Sem ele, as regras deste arquivo só chegam
quando eu leio algum arquivo de dentro do repositório — tarde demais para um
comando que já rodou.

---

## Onde ficam os dados que mudam

Nada disto é repetido aqui: tabela copiada à mão envelhece e vira armadilha.

| O que | Fonte da verdade |
|---|---|
| Gabinetes beta, estilo de cada vereador | `lib/vereadores.ts` — descrição em prosa em [docs/estilos-por-vereador.md](docs/estilos-por-vereador.md) |
| Planos e limites | `lib/planos.ts` |
| Contas de teste por plano | skill `test-login` |

---

## Regra de Modelo LLM

### Produção roda na OpenAI

Conferido no painel da Vercel em 16/09/2026. É isto que está no ar:

| Variável na Vercel | Valor | Efeito |
|---|---|---|
| `LLM_PROVIDER` | `openai` | o adaptador nunca chama a Anthropic |
| `LLM_MODEL_GENERATE` | **não existe** | cai no padrão do código: `gpt-4o` |
| `LLM_MODEL_EXTRACT` | **não existe** | cai no padrão do código: `gpt-4o-mini` |
| `LLM_API_KEY` | chave da OpenAI | é a chave que o gabinete paga |

Então a geração usa **`gpt-4o`** e a extração **`gpt-4o-mini`**, pelos padrões de
`lib/llm.ts`. As 154 indicações do histórico saíram assim.

> **Cuidado com a variável morta.** Existe um `LLM_MODEL=gpt-4o-mini` na Vercel
> que **nenhuma linha do código lê** — o adaptador lê `LLM_MODEL_EXTRACT` e
> `LLM_MODEL_GENERATE`. Editar `LLM_MODEL` não muda modelo nenhum.

Ao trocar de modelo, mexa nas variáveis da Vercel, não só no padrão do código: o
padrão só vale quando a variável não existe.

### Se um dia trocar para a Anthropic

O adaptador suporta os dois provedores. Para migrar: `LLM_API_KEY` recebe uma
chave da Anthropic e `LLM_PROVIDER` vira `anthropic`. Modelos atuais e preço por
milhão de tokens (entrada/saída):

| Modelo | ID | Preço | Papel |
|---|---|---|---|
| Claude Opus 5 | `claude-opus-5` | $5 / $25 | Geração — é o padrão do código |
| Claude Sonnet 5 | `claude-sonnet-5` | $2 / $10 | Geração, mais barato e mais rápido |
| Claude Haiku 4.5 | `claude-haiku-4-5` | $1 / $5 | Extração — é o padrão do código |

- Geração **nunca** deve usar Haiku; extração pode, para economizar.
- **Os IDs não levam sufixo de data.** É `claude-opus-5`, não `claude-opus-5-20260401`.
  Só os modelos antigos (`claude-3-5-haiku-20241022`) usavam esse formato.

#### Três diferenças da geração Claude 5 que quebram código antigo

Estão tratadas em `lib/llm.ts`; se você mexer no adaptador, não desfaça:

1. **`temperature` foi removido** — mandar o parâmetro devolve HTTP 400. O
   adaptador só envia para os modelos que ainda aceitam (`ACEITA_TEMPERATURE`).
   Nossos prompts pediam `temperature: 0` na extração e `0.2` na geração; quem
   garante a consistência agora é o prompt, não o parâmetro.
2. **O primeiro bloco da resposta pode ser `thinking`, com texto vazio.** Ler
   `content[0].text` devolve string vazia. Procure o bloco de `type === 'text'`.
3. **O raciocínio vem ligado por padrão e custa tempo.** O adaptador manda
   `output_config: { effort: 'low' }`, ajustável por `LLM_EFFORT` — a rota roda
   em serverless com timeout de 45s, e o texto segue fórmula do gabinete. Suba
   o esforço só medindo a latência junto.
