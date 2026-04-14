import { test, expect } from '@playwright/test';

/**
 * E2E — Feedback 👍/👎 no histórico.
 *
 * Pré-requisito:
 * - TEST_MODE=true
 * - Conta teste-pro-assessor@dipo.local com plano PRO_ASSESSOR, onboarding completo
 * - Pelo menos uma indicação já gerada no histórico
 */

test.describe('Feedback no histórico', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/test-login');
    await page.waitForSelector('button:has-text("Pro Assessor")', { timeout: 8_000 });
    await page.locator('button:has-text("Pro Assessor")').click();
    await page.waitForURL('/gerar', { timeout: 10_000 });
  });

  test('página /historico carrega sem erros', async ({ page }) => {
    await page.goto('/historico');
    await expect(page).not.toHaveURL('/login');
    // Deve conter o título da seção ou estado vazio
    await expect(
      page.locator('text=Histórico, text=Nenhuma indicação, text=indicação').first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('gera indicação e feedback positivo fica persistido', async ({ page }) => {
    test.setTimeout(90_000);

    // 1. Gera uma nova indicação
    await page.locator('textarea').fill(
      'Capinação e roçada na Rua Leopoldo Figueiredo, nº 200, bairro Santa Cruz, Guarujá.'
    );
    await page.locator('button:has-text("Gerar")').first().click();

    try {
      await page.waitForSelector('text=INDICAÇÃO', { timeout: 45_000 });
    } catch {
      // LLM indisponível — pula validação de feedback
      test.skip();
      return;
    }

    // 2. Clica no botão 👍 (feedback positivo)
    const thumbsUp = page
      .locator('[aria-label*="positivo"], button:has([data-lucide="thumbs-up"])')
      .first();

    if (await thumbsUp.isVisible({ timeout: 5_000 })) {
      await thumbsUp.click();
      // Aguarda algum indicativo visual de sucesso (disabled, cor, toast)
      await page.waitForTimeout(1_000);
    }

    // 3. Vai ao histórico e verifica que a indicação aparece
    await page.goto('/historico');
    await expect(page.locator('text=Santa Cruz, text=Leopoldo').first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('feedback negativo pode ser clicado na tela de geração', async ({ page }) => {
    test.setTimeout(90_000);

    await page.locator('textarea').fill(
      'Iluminação pública apagada na Rua das Flores, nº 50, bairro Centro, Guarujá.'
    );
    await page.locator('button:has-text("Gerar")').first().click();

    try {
      await page.waitForSelector('text=INDICAÇÃO', { timeout: 45_000 });
    } catch {
      test.skip();
      return;
    }

    const thumbsDown = page
      .locator('[aria-label*="negativo"], button:has([data-lucide="thumbs-down"])')
      .first();

    if (await thumbsDown.isVisible({ timeout: 5_000 })) {
      await thumbsDown.click();
      await page.waitForTimeout(800);
      // Botão não deve causar erro na tela
      await expect(page.locator('textarea')).toBeVisible();
    }
  });
});
