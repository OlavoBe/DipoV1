# Guia do Projeto — Dipo

Este arquivo é lido automaticamente pelo Claude Code no início de cada conversa.
Ele documenta decisões arquiteturais, estratégias de teste e regras que devem
ser seguidas ao modificar este projeto.

---

## Stack

- **Framework:** Next.js 16 (App Router)
- **Auth:** NextAuth v5 (beta) — magic link via Resend + Prisma adapter
- **Banco:** PostgreSQL via Prisma ORM (hospedado no Railway)
- **LLM:** Anthropic Claude ou OpenAI (configurável via `LLM_PROVIDER`)
- **PDF:** Playwright (Chromium headless)
- **DOCX:** biblioteca `docx`
- **Email:** Resend

---

## Estratégia de Testes — Login sem Magic Link

### Problema
O produto usa autenticação via magic link (e-mail). Durante testes é inviável
ficar recebendo e-mails para cada conta/plano que precisa ser testado.

### Solução adotada
Existe uma rota e página de login exclusivas para testes que **só funcionam
quando `TEST_MODE=true`** está definido no `.env.local` (arquivo gitignored).
O código dessas rotas **sempre existe no repositório** mas é inerte em produção.

### Como ativar o modo de testes

1. Crie (ou edite) o arquivo `.env.local` na raiz do projeto:
   ```
   TEST_MODE=true
   ```
2. Reinicie o servidor de desenvolvimento (`npm run dev`)
3. Acesse `http://localhost:3000/test-login`

### Como usar

A página `/test-login` oferece:
- **Contas rápidas** pré-definidas por plano (Demo, Trial, Pro Assessor, etc.)
- **Campo livre** para entrar com qualquer e-mail

O login cria uma sessão real no banco (igual ao magic link) — sem JWT,
sem bypass no middleware. Tudo funciona exatamente como em produção.

### Configurar plano de cada conta de teste

Após o primeiro login de uma conta, ela existe no banco sem tenant/plano.
Para associar um plano específico, use o Prisma Studio:

```bash
npx prisma studio
# Acesse http://localhost:5555
```

Fluxo:
1. Crie um **Tenant** com o plano desejado (`DEMO`, `TRIAL`, `PRO_ASSESSOR`, etc.)
2. Associe o **User** ao Tenant (campo `tenantId`)

Ou via SQL direto:
```sql
-- Criar tenant com plano Trial
INSERT INTO "Tenant" (id, nome, plano, "criadoEm")
VALUES (gen_random_uuid()::text, 'Teste Trial', 'TRIAL', now());

-- Associar usuário ao tenant
UPDATE "User" SET "tenantId" = '<id-do-tenant>' WHERE email = 'teste-trial@dipo.local';
```

### Contas de teste pré-definidas na página

| Label         | E-mail                          | Para testar                        |
|---------------|---------------------------------|------------------------------------|
| Demo          | teste-demo@dipo.local           | Plano DEMO (bloqueado na rota auth)|
| Trial         | teste-trial@dipo.local          | Limite de 5/3h                     |
| Pro Assessor  | teste-pro-assessor@dipo.local   | Ilimitado                          |
| Pro Gabinete  | teste-pro-gabinete@dipo.local   | Ilimitado                          |
| Câmara        | teste-camara@dipo.local         | Ilimitado                          |

### Como desativar ao terminar os testes

Simplesmente remova ou comente a linha do `.env.local`:
```
# TEST_MODE=true
```
E reinicie o servidor. As rotas `/test-login` e `/api/test-login` voltam a
retornar 404 automaticamente. **Nenhum código de produção precisa ser alterado.**

### Arquivos envolvidos no modo de testes

```
app/test-login/page.tsx          ← página de login de teste (client component)
app/api/test-login/route.ts      ← endpoint que cria a sessão no banco
.env.local                       ← (gitignored) contém TEST_MODE=true
.env.local.example               ← exemplo commitado para referência
```

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

---

## Limites por plano (lib/planos.ts)

| Plano        | Limite                          |
|--------------|---------------------------------|
| DEMO         | Bloqueado na rota autenticada    |
| TRIAL        | 5 indicações nas últimas 3 horas |
| BETA         | Ilimitado (testadores)           |
| PRO_ASSESSOR | Ilimitado                        |
| PRO_GABINETE | Ilimitado                        |
| CAMARA       | Ilimitado                        |

A demo pública (`/demo` + `/api/demo`) tem limite separado: 1 geração por IP por dia,
controlado pela tabela `DemoUso`.

---

## Beta v2 — Contexto

Estamos expandindo o produto para **4 gabinetes beta**:

| Slug             | Nome completo              | Apelido            |
|------------------|----------------------------|--------------------|
| `valdemir`       | Valdemir Batista Santana   | "Val Advogado"     |
| `ariani_paz`     | Ariani da Silva Paz        | "Ariani"           |
| `juninho_eroso`  | Edmar Lima dos Santos      | "Juninho Eroso"    |
| `marcio_pet`     | Márcio Nabor Tardelli      | "Márcio do Pet Shop" |

A fonte da verdade é `lib/vereadores.ts` — mantenha esta tabela em sincronia com ela.

- O onboarding tem dropdown de seleção de vereador com esses 4 + "Outro vereador"
- Few-shot examples e system prompts são filtrados por vereador quando há perfil dedicado
- Existe plano **BETA** (sem limite de indicações) para usuários testadores beta

---

## Estilos por Vereador

Cada vereador tem um estilo de texto distinto que deve ser respeitado na geração:

| Vereador            | Estilo                                                                                     |
|---------------------|--------------------------------------------------------------------------------------------|
| **Juninho Eroso**   | Direto, sem justificativa longa, padrão clássico (Variação 1), saudação tipo B             |
| **Ariani**          | Texto em CAIXA ALTA, CEP sempre presente, providências numeradas (Variação 2), saudação B  |
| **Márcio do Pet**   | "Fomos procurados por moradores..." + providências numeradas (Variação 2), saudação A ou B |
| **Valdemir**        | Narrativa técnica formal prolíxa, justificativa + indicação separados, saudação tipo A     |

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
