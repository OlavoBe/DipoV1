import { test, expect } from '@playwright/test';

/**
 * E2E — Fluxo de onboarding com seleção de vereador beta.
 *
 * Pré-requisito: TEST_MODE=true no .env.local e servidor rodando em localhost:3000.
 * O teste usa a conta teste-trial@dipo.local (sem tenant vinculado previamente).
 */

test.describe('Onboarding — seleção de vereador', () => {

  test.beforeEach(async ({ page }) => {
    // Login via rota de teste
    await page.goto('/test-login');
    await page.waitForSelector('text=Entrar como');

    // Clica no botão Trial (ou usa campo livre para garantir email limpo)
    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
    if (await emailInput.isVisible()) {
      await emailInput.fill('teste-onboarding-e2e@dipo.local');
      await page.locator('button[type="submit"], button:has-text("Entrar")').last().click();
    } else {
      // Botão de acesso rápido Trial
      await page.locator('button:has-text("Trial")').first().click();
    }

    // Aguarda redirecionamento
    await page.waitForURL(/\/(onboarding|gerar)/, { timeout: 10_000 });
  });

  test('Passo 1: dropdown de vereador está presente', async ({ page }) => {
    await page.goto('/onboarding');
    await expect(page.locator('select')).toBeVisible();
    await expect(page.locator('text=Selecione o vereador')).toBeVisible();
  });

  test('Passo 1: selecionar vereador beta preenche nome e partido automaticamente', async ({ page }) => {
    await page.goto('/onboarding');

    await page.locator('select').selectOption('valdemir');

    // Nome do vereador deve aparecer readonly com o nome completo
    const nomeInput = page.locator('input[readonly]').first();
    await expect(nomeInput).toBeVisible();
    await expect(nomeInput).toHaveValue('VALDEMIR BATISTA SANTANA');

    // Partido deve aparecer preenchido automaticamente
    const partidoInput = page.locator('input[readonly]').nth(1);
    await expect(partidoInput).toHaveValue('Podemos');
  });

  test('Passo 1: selecionar "Outro vereador" exibe campo de texto livre', async ({ page }) => {
    await page.goto('/onboarding');

    await page.locator('select').selectOption('outro');

    // Campo de texto editável para nome custom
    const nomeInput = page.locator('input[placeholder*="Nome completo"]');
    await expect(nomeInput).toBeVisible();
    await expect(nomeInput).not.toHaveAttribute('readonly');
  });

  test('Passo 1: validação bloqueia envio sem vereador selecionado', async ({ page }) => {
    await page.goto('/onboarding');

    // Preenche assessor mas não seleciona vereador
    await page.locator('input[placeholder*="Seu nome"], input[placeholder*="nome"]').last().fill('João Assessor');
    await page.locator('button:has-text("Continuar")').click();

    await expect(page.locator('text=Selecione o gabinete')).toBeVisible();
  });

  test('Passo 1: validação bloqueia envio sem assessor', async ({ page }) => {
    await page.goto('/onboarding');

    await page.locator('select').selectOption('juninho_eroso');
    await page.locator('button:has-text("Continuar")').click();

    await expect(page.locator('text=Campo obrigatório')).toBeVisible();
  });

  test('Passo 1 → Passo 2: salva com vereador beta e avança', async ({ page }) => {
    await page.goto('/onboarding');

    await page.locator('select').selectOption('marcio_pet');

    // Preenche assessor
    const assessorInput = page.locator('input[placeholder*="Seu nome"]');
    await assessorInput.fill('Assessor Teste E2E');

    await page.locator('button:has-text("Continuar")').click();

    // Deve avançar para passo 2
    await expect(page.locator('text=Como o Dipo funciona')).toBeVisible({ timeout: 8_000 });
  });

  test('Passo 2 → Passo 3: avança ao clicar "Entendido"', async ({ page }) => {
    await page.goto('/onboarding');

    // Preenche passo 1 rapidamente
    await page.locator('select').selectOption('ariani_paz');
    await page.locator('input[placeholder*="Seu nome"]').fill('Assessor E2E');
    await page.locator('button:has-text("Continuar")').click();
    await expect(page.locator('text=Como o Dipo funciona')).toBeVisible({ timeout: 8_000 });

    // Avança para passo 3
    await page.locator('button:has-text("Entendido")').click();
    await expect(page.locator('text=Vamos gerar sua primeira indicação')).toBeVisible({ timeout: 5_000 });
  });

  test('Passo 3: pode pular para o painel sem gerar', async ({ page }) => {
    await page.goto('/onboarding');

    // Passo 1
    await page.locator('select').selectOption('juninho_eroso');
    await page.locator('input[placeholder*="Seu nome"]').fill('Assessor Skip');
    await page.locator('button:has-text("Continuar")').click();
    await expect(page.locator('text=Como o Dipo funciona')).toBeVisible({ timeout: 8_000 });

    // Passo 2
    await page.locator('button:has-text("Entendido")').click();
    await expect(page.locator('text=Vamos gerar sua primeira indicação')).toBeVisible({ timeout: 5_000 });

    // Passo 3 — pular
    await page.locator('text=Ir para o painel sem gerar agora').click();
    await page.waitForURL(/\/gerar/, { timeout: 10_000 });
  });
});
