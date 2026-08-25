import { describe, it, expect, afterEach } from 'vitest';
import { emailAutorizadoBeta } from '@/lib/beta-allowlist';

/**
 * O plano BETA é ilimitado e sem prazo. Até esta trava, bastava escolher um dos
 * vereadores beta no dropdown do onboarding — que os lista pelo nome — para
 * recebê-lo, e possivelmente ser vinculado ao tenant daquele gabinete.
 *
 * O padrão precisa ser fechado: sem lista configurada, ninguém entra.
 */

const original = process.env.BETA_EMAILS;

afterEach(() => {
  if (original === undefined) delete process.env.BETA_EMAILS;
  else process.env.BETA_EMAILS = original;
});

describe('emailAutorizadoBeta', () => {
  it('nega quando a variável não existe — padrão fechado', () => {
    delete process.env.BETA_EMAILS;
    expect(emailAutorizadoBeta('assessor@gabinete.com')).toBe(false);
  });

  it('nega quando a lista está vazia ou só tem vírgulas', () => {
    process.env.BETA_EMAILS = '';
    expect(emailAutorizadoBeta('assessor@gabinete.com')).toBe(false);
    process.env.BETA_EMAILS = ' , , ';
    expect(emailAutorizadoBeta('assessor@gabinete.com')).toBe(false);
  });

  it('autoriza quem está na lista', () => {
    process.env.BETA_EMAILS = 'a@x.com,b@y.com';
    expect(emailAutorizadoBeta('b@y.com')).toBe(true);
  });

  it('nega quem não está, mesmo com a lista preenchida', () => {
    process.env.BETA_EMAILS = 'a@x.com,b@y.com';
    expect(emailAutorizadoBeta('c@z.com')).toBe(false);
  });

  it('ignora espaços e maiúsculas — a lista é escrita à mão', () => {
    process.env.BETA_EMAILS = '  A@X.com , b@y.com ';
    expect(emailAutorizadoBeta('a@x.com')).toBe(true);
    expect(emailAutorizadoBeta('  B@Y.COM  ')).toBe(true);
  });

  it('nega e-mail ausente', () => {
    process.env.BETA_EMAILS = 'a@x.com';
    expect(emailAutorizadoBeta(null)).toBe(false);
    expect(emailAutorizadoBeta(undefined)).toBe(false);
    expect(emailAutorizadoBeta('')).toBe(false);
  });

  it('não faz correspondência parcial nem por substring', () => {
    process.env.BETA_EMAILS = 'assessor@gabinete.com';
    expect(emailAutorizadoBeta('assessor@gabinete.com.br')).toBe(false);
    expect(emailAutorizadoBeta('outro-assessor@gabinete.com')).toBe(false);
    expect(emailAutorizadoBeta('assessor@gabinete.co')).toBe(false);
  });
});
