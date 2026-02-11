import { test, expect } from '@playwright/test';

/**
 * Smoke E2E: Public landing and pages that do not require authentication.
 * Run with: npm run test:e2e -- e2e/landing.spec.ts
 */
test.describe('Landing and public pages', () => {
  test('should load landing page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/');
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('body')).toContainText(/ParLeap|You speak|presentation/i);
  });

  test('should show key landing sections', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const body = await page.locator('body').textContent();
    expect(body).toMatch(/voice|visual|song|scripture|testimonial|pricing/i);
  });

  test('should load test-websocket page', async ({ page }) => {
    await page.goto('/test-websocket');
    await expect(page).toHaveURL(/\/test-websocket/);
    await expect(page.locator('body')).toBeVisible();
  });
});
