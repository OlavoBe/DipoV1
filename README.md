# Dipo — Indicações Legislativas

SaaS multi-tenant para geração automática de indicações legislativas a partir de texto livre.
O assessor descreve o pedido em linguagem natural; o sistema extrai os dados estruturados,
gera o texto oficial no estilo do gabinete e exporta em PDF A4 ou Word.

Em beta com 4 gabinetes da Câmara Municipal de Guarujá/SP.

---

## Stack

- **Next.js 16** (App Router, Turbopack) + TypeScript + Tailwind CSS 3
- **PostgreSQL** via Prisma 5 (hospedado no Railway)
- **NextAuth v5 (beta)** — magic link por e-mail (Resend) + Prisma adapter, sessão única por usuário
- **LLM** — Anthropic Claude ou OpenAI, com modelos separados para extração e geração
- **PDF** — Playwright/Chromium (`@sparticuz/chromium` em serverless)
- **DOCX** — biblioteca `docx`
- **Pagamentos** — Mercado Pago (checkout + webhook)
- **Testes** — Vitest (unit + integration) e Playwright (E2E)
- **Deploy** — Vercel

---

## Instalação

### Pré-requisitos

- Node.js 18+
- Um banco PostgreSQL (local, Railway, Supabase…)

### 1. Dependências

```bash
npm install
```

### 2. Chromium para geração de PDF (apenas dev local)

```bash
npx playwright install chromium
```

Em produção (Vercel/Lambda) o binário vem de `@sparticuz/chromium` — não é preciso instalar nada.

### 3. Variáveis de ambiente

```bash
cp .env.example .env
```

Preencha o `.env` (veja a tabela de variáveis abaixo).

### 4. Banco de dados

```bash
npx prisma generate
npx prisma migrate deploy
```

> ⚠️ O histórico de migrations em `prisma/migrations/` está **incompleto** — só existem
> as migrations incrementais do beta v2. Um banco vazio não é criado corretamente por
> `migrate deploy`. Para subir um ambiente do zero use `npx prisma db push`.
> Ver "Problemas conhecidos".

### 5. Rodar

```bash
npm run dev
```

Acesse **http://localhost:3000**.

---

## Variáveis de ambiente

### `.env` (produção e dev)

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | sim | Connection string PostgreSQL |
| `LLM_API_KEY` | sim | Chave da Anthropic ou da OpenAI |
| `LLM_PROVIDER` | não | `anthropic` \| `openai` (padrão: `anthropic`) |
| `LLM_MODEL_EXTRACT` | não | Modelo barato para extração de dados |
| `LLM_MODEL_GENERATE` | não | Modelo mais capaz para o texto formal |
| `NEXTAUTH_SECRET` | sim | `openssl rand -base64 32` (aceita `AUTH_SECRET`) |
| `NEXTAUTH_URL` | sim | URL base da aplicação |
| `RESEND_API_KEY` | sim | Envio do magic link |
| `EMAIL_FROM` | sim | Remetente do magic link |
| `MERCADOPAGO_ACCESS_TOKEN` | só p/ pagamentos | Access token do Mercado Pago |
| `CHROMIUM_EXECUTABLE_PATH` | não | Sobrescreve a URL do pack do Chromium em serverless |

### `.env.local` (dev/testes — gitignored)

| Variável | Descrição |
|---|---|
| `TEST_MODE` | `true` habilita `/test-login` (login sem magic link) |

### Modelos padrão por provider

| | Extração | Geração |
|---|---|---|
| Anthropic | `claude-3-5-haiku-20241022` | `claude-sonnet-4-5-20250929` |
| OpenAI | `gpt-4o-mini` | `gpt-4o` |

---

## Estrutura

```
├── app/
│   ├── (app)/                   # Área autenticada (route group)
│   │   ├── gerar/               # Geração de indicações
│   │   ├── historico/           # Histórico + feedback 👍/👎
│   │   ├── configuracoes/       # Dados do gabinete
│   │   └── plano/               # Plano atual e uso
│   ├── admin/                   # Painel do administrador
│   ├── demo/                    # Demo pública (1 geração por IP/dia)
│   ├── login/  onboarding/      # Autenticação e setup do tenant
│   ├── planos/ upgrade/         # Preços e checkout
│   ├── test-login/              # Login de teste (só com TEST_MODE=true)
│   └── api/                     # Rotas de API (ver abaixo)
├── components/
│   ├── ui/                      # Primitivos (shadcn-style)
│   ├── app/app-shell.tsx        # Layout da área autenticada
│   └── admin/admin-shell.tsx    # Layout do admin
├── lib/
│   ├── pipeline.ts              # Orquestra extract → validate → normalize → geo → generate
│   ├── extract.ts               # Extração de dados estruturados via LLM
│   ├── validator.ts             # Validação Zod + defaults
│   ├── normalizer.ts            # Padronização de capitalização/formato
│   ├── geocoder.ts              # Enriquecimento via Nominatim + ViaCEP
│   ├── generate.ts              # Geração do texto formal (system prompt por vereador)
│   ├── vereadores.ts            # Perfis de estilo dos gabinetes beta
│   ├── template.ts              # Template de formatação (por tenant)
│   ├── pdf.ts  docx.ts          # Exportação
│   ├── planos.ts                # Limites por plano
│   ├── usage-log.ts             # Métricas do beta (fire-and-forget)
│   ├── mercadopago.ts           # Criação de preferência de pagamento
│   ├── admin.ts  db.ts  llm.ts  types.ts
├── prisma/schema.prisma
├── scripts/                     # seed-beta, setup-admin, export-exemplos, export-finetuning
├── tests/                       # unit, integration, e2e
├── data/indicacoes_exemplo/     # Few-shot examples por vereador
├── auth.ts  auth.config.ts      # NextAuth v5
└── proxy.ts                     # Middleware (Next.js 16 renomeou middleware.ts → proxy.ts)
```

---

## API

### Geração e histórico

| Rota | Método | Descrição |
|---|---|---|
| `/api/indicacao` | POST | Gera uma indicação. Aceita `texto`, `complementos`, `templateId`, `ajuste`. Retorna `success` \| `incomplete` \| `error`; `402` quando o limite do plano é atingido |
| `/api/indicacoes` | GET | Lista as indicações do tenant |
| `/api/indicacoes/[id]/feedback` | POST | Registra feedback 👍/👎 |
| `/api/historico` | GET | Últimas 50 indicações do tenant |
| `/api/pdf/[id]` | GET | Download do PDF A4 (`?templateId=`) |
| `/api/docx/[id]` | GET | Download do Word (`?templateId=`) |

### Templates, tenant e conta

| Rota | Método | Descrição |
|---|---|---|
| `/api/template` | GET/POST | Template ativo (ou `?id=`) / salvar |
| `/api/templates` | GET | Lista os templates do tenant |
| `/api/tenant/setup` | POST | Onboarding — cria o tenant e vincula o usuário |
| `/api/auth/[...nextauth]` | GET/POST | NextAuth |

### Demo, pagamentos e admin

| Rota | Método | Descrição |
|---|---|---|
| `/api/demo` | POST | Demo pública — 1 geração por IP/dia, PDF com marca d'água |
| `/api/checkout` | POST | Cria a preferência de pagamento no Mercado Pago |
| `/api/webhooks/mercadopago` | POST | Webhook de confirmação — ativa o plano |
| `/api/admin/stats` | GET | Métricas do beta |
| `/api/admin/usuarios` | GET/POST | Gestão de usuários |
| `/api/admin/usuarios/[id]` | PATCH/DELETE | Edição/remoção de usuário |
| `/api/test-login` | POST | Login de teste — `404` sem `TEST_MODE=true` |

---

## Planos e limites

| Plano | Limite |
|---|---|
| `DEMO` | Bloqueado na área autenticada — usa `/demo` |
| `TRIAL` | 5 indicações por janela de 3 horas |
| `BETA` | Ilimitado (gabinetes testadores) |
| `PRO_ASSESSOR` | Ilimitado — R$ 97/mês |
| `PRO_GABINETE` | Ilimitado — R$ 197/mês |
| `CAMARA` | Ilimitado |

A demo pública tem controle próprio por IP (tabela `DemoUso`).

---

## Perfis de vereador

O texto gerado segue o estilo do gabinete, definido em [`lib/vereadores.ts`](lib/vereadores.ts)
e reforçado por few-shot examples em `data/indicacoes_exemplo/<slug>/`.

| Slug | Vereador | Estilo |
|---|---|---|
| `juninho_eroso` | Edmar Lima dos Santos ("Juninho Eroso") | Direto, sem justificativa, padrão clássico |
| `ariani_paz` | Ariani da Silva Paz | CAIXA ALTA, CEP sempre presente, providências numeradas |
| `marcio_pet` | Márcio Nabor Tardelli ("Márcio do Pet Shop") | "Fomos procurados por moradores…", providências numeradas |
| `valdemir` | Valdemir Batista Santana ("Val Advogado") | Narrativa técnica formal, justificativa separada |
| `outro` | — | Estilo genérico |

---

## Scripts

```bash
npm run dev            # servidor de desenvolvimento
npm run build          # prisma generate + next build
npm run start          # servidor de produção
npm run migrate        # prisma migrate deploy
npm run db:generate    # prisma generate
npm run db:studio      # Prisma Studio (http://localhost:5555)
npm run test           # Vitest (unit + integration)
npm run test:watch     # Vitest em watch
npm run test:coverage  # cobertura
npm run test:e2e       # Playwright E2E
npm run seed:beta      # popula tenants/usuários do beta
```

Scripts avulsos:

```bash
npx tsx scripts/setup-admin.ts        # promove um usuário a admin
npx tsx scripts/export-exemplos.ts    # exporta exemplos aprovados
npx tsx scripts/export-finetuning.ts  # gera dataset para fine-tuning
```

---

## Testes sem magic link

O login de produção é por magic link, inviável em testes. Existe um fluxo alternativo
que **só funciona com `TEST_MODE=true`** no `.env.local` (gitignored) — em produção as
rotas retornam `404` sem nenhuma alteração de código.

1. Crie `.env.local` com `TEST_MODE=true`
2. Reinicie o `npm run dev`
3. Acesse `http://localhost:3000/test-login`

Contas pré-definidas: `teste-demo@`, `teste-trial@`, `teste-pro-assessor@`,
`teste-pro-gabinete@`, `teste-camara@` (todas `@dipo.local`).

Para associar um plano, use o Prisma Studio: crie um `Tenant` com o plano desejado e
preencha o `tenantId` do `User`.

---

## Problemas conhecidos

- **Migrations incompletas.** `.gitignore` ignorava `prisma/migrations/`, então só as
  migrations adicionadas manualmente (`--force`) estão versionadas. Não existe migration
  inicial nem para `DemoUso`, `Indicacao.feedback`, `User.isAdmin`/`onboardingComplete`
  e os campos de onboarding do `Tenant`. Um banco novo precisa de `prisma db push`.
  A regra do `.gitignore` já foi removida — novas migrations devem ser commitadas.
- **Template não é filtrado por tenant na exportação.** `lib/pdf.ts`, `lib/docx.ts` e
  `lib/generate.ts` chamam `getTemplate(templateId)` sem passar `tenantId`, então o
  template ativo é buscado sem filtro de tenant.
- **Download cross-tenant.** Em `/api/pdf/[id]` e `/api/docx/[id]`, um usuário sem tenant
  vinculado consegue baixar qualquer indicação por ID — o filtro de tenant só é aplicado
  quando `session.user.tenantId` existe.
- **`saveActiveTemplate` com tenant vazio.** Ao salvar um template sem `tenantId`, grava
  `tenantId: ''`, o que viola a foreign key no PostgreSQL.

---

## Ganchos para futuras versões

- [ ] Numeração sequencial oficial da indicação
- [ ] Integração WhatsApp
- [ ] Upload de anexos / fotos e OCR
- [ ] Dashboard e relatórios por bairro e tipo
- [ ] Geração em lote
