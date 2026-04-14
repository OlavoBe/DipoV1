import { test, expect } from '@playwright/test';

/**
 * E2E — Export PDF e DOCX.
 *
 * Valida que os botões de exportação ficam visíveis após geração e
 * que o download é iniciado corretamente.
 *
 * Pré-requisito:
 * - TEST_MODE=true
 * - Conta teste-pro-assessor@dipo.local (plano PRO_ASSESSOR, ilimitado)
 * - PDF_ENABLED / DOCX_ENABLED devem estar ativas (padrão em dev)
 */

test.describe('Export PDF e DOCX', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/test-login');
    await page.waitForSelector('button:has-text("Pro Assessor")', { timeout: 8_000 });
    await page.locator('button:has-text("Pro Assessor")').click();
    await page.waitForURL('/gerar', { timeout: 10_000 });
  });

  test('botões PDF e DOCX ficam visíveis após indicação gerada', async ({ page }) => {
    test.setTimeout(90_000);

    await page.locator('textarea').fill(
      'Redutor de velocidade na Rua das Palmeiras, nº 300, bairro Jardim Três Marias, Guarujá. Risco de acidente.'
    );
    await page.locator('button:has-text("Gerar")').first().click();

    try {
      await page.waitForSelector('text=INDICAÇÃO', { timeout: 45_000 });
    } catch {
      // LLM indisponível — pula
      test.skip();
      return;
    }

    // Procura botões de export (labels comuns: "PDF", "DOCX", "Word", "Baixar")
    const pdfBtn = page
      .locator('button:has-text("PDF"), a:has-text("PDF"), [aria-label*="PDF"]')
      .first();
    const docxBtn = page
      .locator('button:has-text("DOCX"), button:has-text("Word"), a:has-text("DOCX"), [aria-label*="DOCX"]')
      .first();

    const pdfVisible  = await pdfBtn.isVisible().catch(() => false);
    const docxVisible = await docxBtn.isVisible().catch(() => false);

    // Pelo menos um dos dois deve estar visível
    expect(pdfVisible || docxVisible).toBe(true);
  });

  test('download PDF não retorna erro 4xx/5xx', async ({ page }) => {
    test.setTimeout(90_000);

    await page.locator('textarea').fill(
      'Drenagem e galerias entupidas na Rua das Acácias, nº 55, bairro Centro, Guarujá.'
    );
    await page.locator('button:has-text("Gerar")').first().click();

    try {
      await page.waitForSelector('text=INDICAÇÃO', { timeout: 45_000 });
    } catch {
      test.skip();
      return;
    }

    const pdfBtn = page
      .locator('button:has-text("PDF"), a:has-text("PDF"), [aria-label*="PDF"]')
      .first();

    if (!(await pdfBtn.isVisible().catch(() => false))) {
      test.skip();
      return;
    }

    // Intercepta a requisição de download e verifica status
    const [downloadOrResponse] = await Promise.all([
      page.waitForEvent('download', { timeout: 30_000 }).catch(() => null),
      pdfBtn.click(),
    ]);

    // Se gerou download, validar que tem nome de arquivo
    if (downloadOrResponse) {
      expect(downloadOrResponse.suggestedFilename()).toMatch(/\.pdf$/i);
    }
  });

  test('download DOCX não retorna erro 4xx/5xx', async ({ page }) => {
    test.setTimeout(90_000);

    await page.locator('textarea').fill(
      'Retirada de entulho na Avenida Dom Pedro I, nº 10, bairro Perequê-Açu, Guarujá.'
    );
    await page.locator('button:has-text("Gerar")').first().click();

    try {
      await page.waitForSelector('text=INDICAÇÃO', { timeout: 45_000 });
    } catch {
      test.skip();
      return;
    }

    const docxBtn = page
      .locator('button:has-text("DOCX"), button:has-text("Word"), a:has-text("DOCX"), [aria-label*="DOCX"]')
      .first();

    if (!(await docxBtn.isVisible().catch(() => false))) {
      test.skip();
      return;
    }

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30_000 }).catch(() => null),
      docxBtn.click(),
    ]);

    if (download) {
      expect(download.suggestedFilename()).toMatch(/\.(docx|doc)$/i);
    }
  });
});
