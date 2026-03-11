# Indicações Legislativas — Câmara Municipal de Guarujá/SP

Sistema MVP para geração automática de indicações legislativas a partir de texto livre.

## Stack

- **Next.js 14** (App Router) + TypeScript
- **SQLite** via Prisma (persistência local)
- **Playwright** (geração de PDF A4)
- **LLM** via API (Anthropic Claude ou OpenAI)

---

## Instalação

### Pré-requisitos

- Node.js 18+
- npm ou yarn

### 1. Instalar dependências

```bash
npm install
```

### 2. Instalar Chromium (para geração de PDF)

```bash
npx playwright install chromium
```

### 3. Configurar variáveis de ambiente

Copie o arquivo de exemplo e preencha com sua chave de API:

```bash
cp .env.example .env
```

Edite o `.env`:

```env
DATABASE_URL="file:./dev.db"
LLM_API_KEY=sua_chave_anthropic_ou_openai
LLM_PROVIDER=anthropic          # ou: openai
LLM_MODEL=claude-3-5-haiku-20241022
```

Chaves disponíveis em:
- Anthropic: https://console.anthropic.com/
- OpenAI: https://platform.openai.com/api-keys

### 4. Criar banco de dados

```bash
npm run db:migrate
```

Ou combinado:

```bash
npx prisma generate && npx prisma migrate dev --name init
```

### 5. Rodar localmente

```bash
npm run dev
```

Acesse: **http://localhost:3000**

---

## Como gerar uma indicação de exemplo

1. Acesse http://localhost:3000
2. Cole o texto no campo "Relato do pedido":

```
Na Rua das Palmeiras, número 340, bairro Jardim Três Marias, existe um buraco
de aproximadamente 60cm de diâmetro no meio da pista. O local é de grande
movimento e já causou queda de motociclistas. Solicito urgente operação tapa-buraco.
```

3. Clique em **Gerar Indicação**
4. Visualize a prévia e clique em **Baixar PDF**

---

## Estrutura de pastas

```
├── app/
│   ├── page.tsx               # UI principal
│   ├── historico/page.tsx     # Histórico de indicações
│   └── api/
│       ├── indicacao/route.ts # Endpoint principal (POST)
│       ├── historico/route.ts # Listar histórico (GET)
│       └── pdf/[id]/route.ts  # Download PDF (GET)
├── lib/
│   ├── db.ts                  # Prisma client
│   ├── llm.ts                 # Adapter LLM (Anthropic/OpenAI)
│   ├── extract.ts             # Extração de dados estruturados
│   ├── generate.ts            # Geração do texto da indicação
│   ├── pdf.ts                 # Geração do PDF A4 via Playwright
│   └── types.ts               # Types TypeScript
├── prisma/
│   └── schema.prisma          # Schema do banco
├── .env                       # Variáveis de ambiente (não commitar)
└── .env.example               # Template de variáveis
```

---

## API Endpoints

### `POST /api/indicacao`

Gera uma indicação a partir de texto livre.

**Body:**
```json
{
  "texto": "descrição do problema...",
  "complementos": {}
}
```

**Resposta (sucesso):**
```json
{
  "status": "success",
  "texto_final": "INDICAÇÃO – TAPA-BURACO...",
  "record_id": "clxxx...",
  "extracted": { ... }
}
```

**Resposta (informações faltando):**
```json
{
  "status": "incomplete",
  "perguntas_faltantes": ["Qual é o nome da rua?", "Qual é o bairro?"],
  "extracted": { ... }
}
```

### `GET /api/historico`

Retorna as últimas 50 indicações geradas.

### `GET /api/pdf/:id`

Gera e baixa o PDF A4 de uma indicação pelo ID.

---

## Modo Demo

Se `LLM_API_KEY` não estiver configurada, o sistema retorna uma mensagem de erro amigável explicando que a chave está faltando. Nenhum dado é enviado para APIs externas.

---

## Troca de Provider LLM

Para usar OpenAI ao invés de Anthropic:

```env
LLM_PROVIDER=openai
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4o-mini
```

---

## Banco de dados (SQLite)

Para visualizar os dados salvos:

```bash
npm run db:studio
```

Abre o Prisma Studio em http://localhost:5555

---

## Funcionalidades implementadas (MVP)

- [x] Campo de texto livre para relato do problema
- [x] Extração automática de dados estruturados via LLM
- [x] Detecção de campos faltantes com perguntas objetivas
- [x] Geração do texto oficial da indicação legislativa
- [x] PDF A4 pronto para impressão (Playwright)
- [x] Download imediato do PDF
- [x] Copiar texto para clipboard
- [x] Histórico com as últimas 50 indicações
- [x] Re-download de PDF de indicações antigas
- [x] Modo demo (erro amigável sem API key)
- [x] Suporte a Anthropic e OpenAI

## Ganchos para futuras versões

- [ ] Autenticação de usuários
- [ ] Numeração sequencial oficial
- [ ] Integração WhatsApp
- [ ] Validação de CEP via Google Maps
- [ ] Dashboard / relatórios por bairro e tipo
- [ ] Upload de anexos / fotos
- [ ] OCR para extrair texto de imagens
- [ ] Geração em lote (batch)
