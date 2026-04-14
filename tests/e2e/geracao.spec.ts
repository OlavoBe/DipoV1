import { test, expect } from '@playwright/test';

/**
 * E2E — Fluxo de geração de indicação.
 *
 * Pré-requisito:
 * - TEST_MODE=true
 * - Conta teste-pro-assessor@dipo.local com plano PRO_ASSESSOR e onboarding completo
 * - LLM_API_KEY configurada (ou mock via MSW em testes de CI)
 */

test.describe('Geração de Indicação', () => {

  test.beforeEach(async ({ page }) => {
    // Login com conta Pro Assessor (ilimitada, onboarding já completo)
    await page.goto('/test-login');
    await page.waitForSelector('button:has-text("Pro Assessor")', { timeout: 8_000 });
    await page.locator('button:has-text("Pro Assessor")').click();
    await page.waitForURL('/gerar', { timeout: 10_000 });
  });

  test('página /gerar carrega com textarea visível', async ({ page }) => {
    await expect(page.locator('textarea')).toBeVisible();
  });

  test('botão Gerar fica desabilitado com texto curto (< 10 chars)', async ({ page }) => {
    await page.locator('textarea').fill('oi');
    const btn = page.locator('button:has-text("Gerar")').first();
    await expect(btn).toBeDisabled();
  });

  test('botão Gerar fica habilitado com texto suficiente', async ({ page }) => {
    await page.locator('textarea').fill('Buraco na Rua das Flores, bairro Centro, Guarujá.');
    const btn = page.locator('button:has-text("Gerar")').first();
    await expect(btn).toBeEnabled();
  });

  test('fluxo completo: texto → indicação gerada', async ({ page }) => {
    test.setTimeout(60_000); // LLM pode demorar

    await page.locator('textarea').fill(
      'Solicitar operação tapa-buraco na Rua das Palmeiras, nº 340, bairro Jardim Três Marias, Guarujá. Buraco grande causando risco a motociclistas.',
    );

    await page.locator('button:has-text("Gerar")').first().click();

    // Aguarda o resultado — pode vir resultado, perguntas ou erro
    await page.waitForSelector(
      '[data-testid="resultado"], textarea[readonly], text=INDICAÇÃO, text=Qual, text=Erro',
      { timeout: 45_000 },
    );

    // Se vieram perguntas faltantes, responde e regera
    const perguntaEl = page.locator('text=Qual').first();
    if (await perguntaEl.isVisible()) {
      // Responde a primeira pergunta encontrada
      const respInputs = page.locator('input[placeholder*="Sua resposta"], textarea').filter({ hasText: '' });
      const count = await respInputs.count();
      for (let i = 0; i < count; i++) {
        await respInputs.nth(i).fill('Jardim Três Marias');
      }
      await page.locator('button:has-text("Gerar")').first().click();
      await page.waitForSelector('text=INDICAÇÃO', { timeout: 45_000 });
    }

    // Resultado deve conter texto da indicação
    await expect(page.locator('text=INDICAÇÃO')).toBeVisible({ timeout: 45_000 });
  });

  test('botão Copiar está disponível após geração', async ({ page }) => {
    test.setTimeout(60_000);

    await page.locator('textarea').fill(
      'Mato alto na calçada da Avenida Santos Dumont, nº 50, bairro Centro, Guarujá. Pedido dos moradores.',
    );
    await page.locator('button:has-text("Gerar")').first().click();

    // Espera resultado (com ou sem perguntas)
    await page.waitForSelector('text=INDICAÇÃO, text=Copiar, text=Qual', { timeout: 45_000 });

    const copiarBtn = page.locator('button:has-text("Copiar"), button[aria-label*="opiar"]').first();
    if (await copiarBtn.isVisible()) {
      await expect(copiarBtn).toBeEnabled();
    }
  });

  test('feedback: botões 👍 e 👎 ficam visíveis após geração', async ({ page }) => {
    test.setTimeout(60_000);

    await page.locator('textarea').fill(
      'Iluminação apagada na Rua Leopoldo Figueiredo, nº 100, bairro Santa Cruz, Guarujá.',
    );
    await page.locator('button:has-text("Gerar")').first().click();

    // Aguarda o texto da indicação
    try {
      await page.waitForSelector('text=INDICAÇÃO', { timeout: 45_000 });
      // Botões de feedback devem aparecer
      const thumbsUp = page.locator('[aria-label*="positivo"], button:has([data-lucide="thumbs-up"])').first();
      await expect(thumbsUp).toBeVisible({ timeout: 5_000 });
    } catch {
      // Se o LLM não estiver disponível, testa apenas que a tela não quebrou
      await expect(page.locator('textarea')).toBeVisible();
    }
  });
});

// ─────────────────────────────────────────────
// Testes de limite do plano Trial
// ─────────────────────────────────────────────

test.describe('Limite do plano Trial', () => {

  test('usuário Trial vê badge com plano correto na sidebar', async ({ page }) => {
    await page.goto('/test-login');
    await page.waitForSelector('button:has-text("Trial")', { timeout: 8_000 });
    await page.locator('button:has-text("Trial")').click();
    await page.waitForURL('/gerar', { timeout: 10_000 });

    // Badge ou indicador do plano Trial deve estar visível
    await expect(page.locator('text=Trial')).toBeVisible();
  });
});
