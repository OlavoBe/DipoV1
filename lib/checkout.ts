/**
 * Estado do checkout pago.
 *
 * ── Por que está suspenso ────────────────────────────────────────────────────
 * A tela anuncia "R$ 97 /mês" e "Cancele quando quiser", mas nada disso existe
 * no código. `lib/mercadopago.ts` cria uma `Preference`, que é **cobrança
 * avulsa** — não há assinatura, não há renovação e não há o que cancelar.
 *
 * E o webhook fecha o ciclo pelo lado errado: em `approved` ele grava
 * `plano: PRO_*` sem prazo nenhum. Ou seja, quem pagasse R$ 97 uma única vez
 * ficaria com plano Pro para sempre, acreditando ter assinado um mensal.
 *
 * Suspender é a única posição honesta enquanto as duas pontas não existirem.
 *
 * ── O que precisa existir para reativar ──────────────────────────────────────
 *  1. `Preapproval` do Mercado Pago (assinatura de verdade) no lugar de
 *     `Preference`, com `frequency` e `frequency_type` mensais.
 *  2. Tratamento de renovação, falha de cobrança e cancelamento no webhook.
 *  3. Prazo de validade no tenant — hoje `planoAtivoEm` é gravado mas nunca
 *     lido para expirar nada.
 *
 * Com os três, troque esta constante para `false`.
 */
export const CHECKOUT_SUSPENSO = true;

/** Mensagem única, usada pela API e pela tela — para não divergirem. */
export const MOTIVO_SUSPENSAO =
  'A assinatura está temporariamente indisponível enquanto preparamos a cobrança recorrente. Nenhuma cobrança será feita.';
