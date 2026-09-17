---
name: test-login
description: Como entrar no Dipo sem magic link durante o desenvolvimento, e como dar plano a uma conta de teste. Use quando for testar login, planos, limites por plano, ou quando precisar de uma conta de um plano especifico (DEMO, TRIAL, BETA, PRO_ASSESSOR, PRO_GABINETE, CAMARA).
---

# Login de teste sem magic link

## Problema

O produto autentica por magic link (e-mail). Durante testes e inviavel ficar
recebendo e-mail para cada conta e cada plano que precisa ser exercitado.

## Solucao adotada

Existe uma rota e uma pagina de login exclusivas para teste que **so funcionam
com `TEST_MODE=true`** no `.env.local` (arquivo gitignored). O codigo dessas
rotas **sempre existe no repositorio** e e inerte em producao.

O login cria uma sessao real no banco, igual ao magic link — sem JWT, sem bypass
no middleware. Tudo funciona exatamente como em producao.

## Ativar

1. No `.env.local` da raiz do projeto:
   ```
   TEST_MODE=true
   ```
2. Reinicie o servidor (`npm run dev`).
3. Acesse `http://localhost:3000/test-login`.

## Contas pre-definidas na pagina

| Label        | E-mail                        | Para testar                         |
|--------------|-------------------------------|-------------------------------------|
| Demo         | teste-demo@dipo.local         | Plano DEMO (bloqueado na rota auth) |
| Trial        | teste-trial@dipo.local        | Limite de 5/3h                      |
| Pro Assessor | teste-pro-assessor@dipo.local | Ilimitado                           |
| Pro Gabinete | teste-pro-gabinete@dipo.local | Ilimitado                           |
| Camara       | teste-camara@dipo.local       | Ilimitado                           |

A pagina tambem tem campo livre para qualquer e-mail.

## Dar um plano a uma conta

Depois do primeiro login a conta existe no banco sem tenant e sem plano.

Pelo Prisma Studio:
```bash
npx prisma studio   # http://localhost:5555
```
1. Crie um **Tenant** com o plano desejado.
2. Associe o **User** ao Tenant pelo campo `tenantId`.

Ou por SQL:
```sql
INSERT INTO "Tenant" (id, nome, plano, "criadoEm")
VALUES (gen_random_uuid()::text, 'Teste Trial', 'TRIAL', now());

UPDATE "User" SET "tenantId" = '<id-do-tenant>' WHERE email = 'teste-trial@dipo.local';
```

Os planos validos estao em `lib/planos.ts`.

## Desativar

Comente a linha no `.env.local` e reinicie:
```
# TEST_MODE=true
```
As rotas `/test-login` e `/api/test-login` voltam a devolver 404 sozinhas.
**Nenhum codigo de producao precisa ser alterado.**

## Arquivos

```
app/test-login/page.tsx       pagina de login de teste (client component)
app/api/test-login/route.ts   endpoint que cria a sessao no banco
.env.local                    (gitignored) contem TEST_MODE=true
.env.local.example            exemplo commitado para referencia
```
