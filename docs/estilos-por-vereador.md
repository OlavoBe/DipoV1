# Gabinetes beta e estilo de texto de cada um

> A **fonte da verdade é `lib/vereadores.ts`** — 112 linhas, com todos os campos
> (`slug`, `nomeCompleto`, `apelido`, `saudacao`, `estiloCorpo`,
> `estiloJustificativa`, `usaCaixaAlta`). Este documento existe porque a
> descrição em prosa do estilo se lê melhor que as flags em TypeScript, não
> porque seja uma segunda fonte. **Se divergirem, o código está certo.**

## Os quatro gabinetes beta

| Slug | Nome completo | Apelido |
|---|---|---|
| `valdemir` | Valdemir Batista Santana | "Val Advogado" |
| `ariani_paz` | Ariani da Silva Paz | "Ariani" |
| `juninho_eroso` | Edmar Lima dos Santos | "Juninho Eroso" |
| `marcio_pet` | Márcio Nabor Tardelli | "Márcio do Pet Shop" |

- O onboarding tem dropdown com esses 4 + "Outro vereador".
- Few-shot examples e system prompts são filtrados por vereador quando há
  perfil dedicado.
- Existe o plano **BETA** (sem limite de indicações) para os testadores.

## O estilo de cada um

| Vereador | Estilo |
|---|---|
| **Juninho Eroso** | Direto, sem justificativa longa, padrão clássico (Variação 1), saudação tipo B |
| **Ariani** | Texto em CAIXA ALTA, CEP sempre presente, providências numeradas (Variação 2), saudação B |
| **Márcio do Pet** | "Fomos procurados por moradores..." + providências numeradas (Variação 2), saudação A ou B |
| **Valdemir** | Narrativa técnica formal prolixa, justificativa + indicação separadas, saudação tipo A |

## Limites por plano

Estão em `lib/planos.ts` (`TRIAL_MAX = 5`, `TRIAL_JANELA_MS = 3h`). Em resumo:
DEMO é bloqueado na rota autenticada, TRIAL tem 5 indicações por 3 horas, e
BETA, PRO_ASSESSOR, PRO_GABINETE e CAMARA são ilimitados.

A demo pública (`/demo` + `/api/demo`) tem limite separado: 1 geração por IP por
dia, controlado pela tabela `DemoUso`.
