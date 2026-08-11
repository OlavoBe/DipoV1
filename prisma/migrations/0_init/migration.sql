-- ============================================================
-- Baseline do schema (0_init)
--
-- O .gitignore ignorava prisma/migrations/, então o histórico de migrations
-- nasceu incompleto: só as três migrations 20260413_* chegaram ao repositório
-- (adicionadas com --force). Tudo o que veio antes delas — e os campos do beta
-- que foram aplicados via `db push` — nunca teve migration.
--
-- Esta migration reconstrói esse estado inicial. Ela é INTEGRALMENTE
-- IDEMPOTENTE, para poder rodar nos dois cenários:
--
--   • Banco novo  → cria tudo; as 20260413_* seguintes completam o schema.
--   • Banco atual (Railway) → é um no-op; o Prisma apenas a registra em
--     _prisma_migrations, sem nenhuma alteração no banco.
--
-- Por isso NÃO inclui o que as três migrations posteriores já fazem:
--   • valor 'BETA' no enum Plano   → 20260413_add_beta_plan
--   • tabela UsageLog              → 20260413_add_usage_log
--   • coluna Tenant.vereadorSlug   → 20260413_add_vereador_slug
--
-- Não edite as migrations 20260413_* — elas já foram aplicadas em produção e
-- alterá-las quebra o checksum do Prisma.
-- ============================================================

-- ─────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────

DO $$ BEGIN
    CREATE TYPE "Plano" AS ENUM ('DEMO', 'TRIAL', 'PRO_ASSESSOR', 'PRO_GABINETE', 'CAMARA');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "Papel" AS ENUM ('ADMIN', 'ASSESSOR');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────
-- Tabelas
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Tenant" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "plano" "Plano" NOT NULL DEFAULT 'DEMO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mpCustomerId" TEXT,
    "planoAtivoEm" TIMESTAMP(3),
    "nomeVereador" TEXT NOT NULL DEFAULT '',
    "nomePartido" TEXT NOT NULL DEFAULT '',
    "municipio" TEXT NOT NULL DEFAULT 'Guarujá',
    "nomeAssessor" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Indicacao" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inputRaw" TEXT NOT NULL,
    "extractedJson" TEXT NOT NULL,
    "textoFinal" TEXT NOT NULL,
    "tipoServico" TEXT NOT NULL,
    "bairro" TEXT NOT NULL,
    "logradouro" TEXT NOT NULL,
    "numero" TEXT,
    "cep" TEXT,
    "feedback" INTEGER,
    "feedbackEm" TIMESTAMP(3),
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "Indicacao_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Template" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'default',
    "settings" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "nome" TEXT,
    "papel" "Papel" NOT NULL DEFAULT 'ASSESSOR',
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "tenantId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Account" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "deviceToken" TEXT NOT NULL DEFAULT '',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "DemoUso" (
    "id" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "contagem" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "DemoUso_pkey" PRIMARY KEY ("id")
);

-- ─────────────────────────────────────────────
-- Índices
-- ─────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");
CREATE UNIQUE INDEX IF NOT EXISTS "Session_sessionToken_key" ON "Session"("sessionToken");
CREATE UNIQUE INDEX IF NOT EXISTS "VerificationToken_token_key" ON "VerificationToken"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");
CREATE UNIQUE INDEX IF NOT EXISTS "DemoUso_ip_data_key" ON "DemoUso"("ip", "data");

-- ─────────────────────────────────────────────
-- Foreign keys
-- (Postgres não tem ADD CONSTRAINT IF NOT EXISTS)
-- ─────────────────────────────────────────────

DO $$ BEGIN
    ALTER TABLE "Indicacao" ADD CONSTRAINT "Indicacao_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Template" ADD CONSTRAINT "Template_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
