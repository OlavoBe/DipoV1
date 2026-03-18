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
| Trial         | teste-trial@dipo.local          | Limite de 3/semana                 |
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
- **Não usar `git add -A`** — adicionar arquivos específicos para evitar
  commitar `.env.local` acidentalmente.

---

## Limites por plano (lib/planos.ts)

| Plano        | Limite                          |
|--------------|---------------------------------|
| DEMO         | Bloqueado na rota autenticada   |
| TRIAL        | 3 indicações nos últimos 7 dias |
| PRO_ASSESSOR | Ilimitado                       |
| PRO_GABINETE | Ilimitado                       |
| CAMARA       | Ilimitado                       |

A demo pública (`/demo` + `/api/demo`) tem limite separado: 1 geração por IP por dia,
controlado pela tabela `DemoUso`.
