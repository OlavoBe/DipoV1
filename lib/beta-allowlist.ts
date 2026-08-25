/**
 * Quem pode receber o plano BETA ao se cadastrar.
 *
 * ── Por que isto existe ──────────────────────────────────────────────────────
 * O onboarding oferece um dropdown com os 4 vereadores beta, pelo nome. Até
 * aqui, escolher um deles concedia plano BETA — que é **ilimitado e sem prazo**
 * — a qualquer pessoa que se cadastrasse. Não havia convite, pagamento nem
 * verificação: bastava saber um nome que a própria tela mostrava.
 *
 * Pior que o acesso: quem escolhia um vereador beta podia ser vinculado ao
 * tenant daquele gabinete. Agora um e-mail não autorizado sempre recebe um
 * tenant próprio em TRIAL, então nunca encosta nos dados de um gabinete real.
 *
 * ── Como autorizar alguém ────────────────────────────────────────────────────
 * Variável de ambiente `BETA_EMAILS`, e-mails separados por vírgula:
 *
 *   BETA_EMAILS=assessor@gabinete.com,outro@gabinete.com
 *
 * Sem a variável, ninguém recebe BETA no cadastro — o padrão é fechado, e essa
 * é a escolha certa para um plano ilimitado. Quem já tem tenant BETA continua
 * como está: esta checagem só decide o plano de tenants novos.
 *
 * Para promover alguém depois do cadastro, use o admin em /admin/usuarios, que
 * já permite trocar o plano sem passar por aqui.
 */

/** E-mails autorizados, normalizados. Lido a cada chamada para refletir mudança de env sem rebuild. */
function listaAutorizada(): string[] {
  return (process.env.BETA_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * `true` apenas se o e-mail estiver explicitamente na lista.
 *
 * Comparação em minúsculas e sem espaços nas pontas — a lista é escrita à mão
 * numa variável de ambiente, então erro de digitação com espaço é esperado.
 * Não normaliza mais que isso de propósito: tratar unicode aqui reintroduziria
 * a classe de bug do homoglyph que a própria Auth.js acabou de corrigir.
 */
export function emailAutorizadoBeta(email: string | null | undefined): boolean {
  if (!email) return false;
  return listaAutorizada().includes(email.trim().toLowerCase());
}
