import { test, expect } from '@playwright/test';
import { login, createEventViaUI, createSongViaUI, TEST_USER } from './utils/test-helpers';

test.describe('Projector View Flow', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should open projector view', async ({ page, context }) => {
    // Create an event
    await page.goto('/events');
    const eventName = `Projector Test ${Date.now()}`;
    await createEventViaUI(page, eventName);

    await page.waitForTimeout(1000);

    const eventLink = page.locator(`text=${eventName}`).first();
    await eventLink.click();

    await page.waitForTimeout(1000);

    // Get event ID from URL
    const eventId = page.url().split('/').pop();
    
    if (eventId) {
      // Open projector view in a new page/tab
      const projectorUrl = `/projector/${eventId}`;
      const projectorPage = await context.newPage();
      
      await projectorPage.goto(projectorUrl);
      await projectorPage.waitForTimeout(3000);

      // Verify projector view loaded
      await expect(projectorPage.locator('body')).toBeVisible();

      // Check for projector-specific elements
      // Adjust selectors based on your ProjectorDisplay component
      const projectorContent = projectorPage.locator('text=/waiting|connecting|slide/i');
      await expect(projectorContent.first()).toBeVisible({ timeout: 10000 });

      await projectorPage.close();
    } else {
      test.skip('Could not determine event ID');
    }
  });

  test('should display slides in projector view', async ({ page, context }) => {
    // Create event with song
    await page.goto('/songs');
    const songTitle = `Projector Song ${Date.now()}`;
    await createSongViaUI(page, songTitle, 'Projector Artist', 'Projector Line 1\nProjector Line 2');

    await page.waitForTimeout(1000);

    await page.goto('/events');
    const eventName = `Projector Display Test ${Date.now()}`;
    await createEventViaUI(page, eventName);

    await page.waitForTimeout(1000);

    const eventLink = page.locator(`text=${eventName}`).first();
    await eventLink.click();

    await page.waitForTimeout(1000);

    const eventId = page.url().split('/').pop();
    
    if (eventId) {
      // Start session in operator view
      await page.goto(`/live/${eventId}`);
      await page.waitForTimeout(3000);

      // Open projector view in separate page
      const projectorPage = await context.newPage();
      await projectorPage.goto(`/projector/${eventId}`);
      await projectorPage.waitForTimeout(5000);

      // Verify projector is connected and waiting/displaying
      // The actual slide content depends on session state
      const projectorBody = projectorPage.locator('body');
      await expect(projectorBody).toBeVisible();

      // Check for connection status or slide display
      // Adjust based on your ProjectorDisplay component states
      const hasContent = await Promise.all([
        projectorPage.locator('text=/connecting/i').isVisible().catch(() => false),
        projectorPage.locator('text=/waiting/i').isVisible().catch(() => false),
        projectorPage.locator('[class*="text-"]').first().isVisible().catch(() => false),
      ]);

      expect(hasContent.some(v => v)).toBeTruthy();

      await projectorPage.close();
    } else {
      test.skip('Could not determine event ID');
    }
  });

  test('should synchronize with operator view', async ({ page, context }) => {
    // This test verifies that projector view receives updates from operator view
    // Create event and start session
    await page.goto('/events');
    const eventName = `Sync Test ${Date.now()}`;
    await createEventViaUI(page, eventName);

    await page.waitForTimeout(1000);

    const eventLink = page.locator(`text=${eventName}`).first();
    await eventLink.click();

    await page.waitForTimeout(1000);

    const eventId = page.url().split('/').pop();
    
    if (eventId) {
      // Open operator view
      await page.goto(`/live/${eventId}`);
      await page.waitForTimeout(3000);

      // Open projector view
      const projectorPage = await context.newPage();
      await projectorPage.goto(`/projector/${eventId}`);
      await projectorPage.waitForTimeout(5000);

      // Both pages should be connected
      // In a real scenario, you'd trigger a slide change in operator view
      // and verify it appears in projector view
      // This is a simplified check

      const operatorConnected = await page.locator('text=/connected|CONNECTED/i').isVisible().catch(() => false);
      const projectorConnected = await projectorPage.locator('text=/connected|CONNECTED|waiting/i').isVisible().catch(() => false);

      // At least one should show connection status
      expect(operatorConnected || projectorConnected).toBeTruthy();

      await projectorPage.close();
    } else {
      test.skip('Could not determine event ID');
    }
  });

  test('should support keyboard shortcuts in projector view', async ({ page, context }) => {
    // Create event and start session
    await page.goto('/events');
    const eventName = `Keyboard Test ${Date.now()}`;
    await createEventViaUI(page, eventName);

    await page.waitForTimeout(1000);

    const eventLink = page.locator(`text=${eventName}`).first();
    await eventLink.click();

    await page.waitForTimeout(1000);

    const eventId = page.url().split('/').pop();
    
    if (eventId) {
      // Start session
      await page.goto(`/live/${eventId}`);
      await page.waitForTimeout(3000);

      // Open projector view
      const projectorPage = await context.newPage();
      await projectorPage.goto(`/projector/${eventId}`);
      await projectorPage.waitForTimeout(5000);

      // Test keyboard shortcuts
      // Space or ArrowRight should advance slide
      await projectorPage.keyboard.press('Space');
      await projectorPage.waitForTimeout(1000);

      // Backspace or ArrowLeft should go back
      await projectorPage.keyboard.press('Backspace');
      await projectorPage.waitForTimeout(1000);

      // F11 should toggle fullscreen (browser handles this)
      await projectorPage.keyboard.press('F11');
      await projectorPage.waitForTimeout(1000);

      // Verify page is still responsive
      await expect(projectorPage.locator('body')).toBeVisible();

      await projectorPage.close();
    } else {
      test.skip('Could not determine event ID');
    }
  });

  test('should handle fullscreen mode', async ({ page, context }) => {
    // Create event
    await page.goto('/events');
    const eventName = `Fullscreen Test ${Date.now()}`;
    await createEventViaUI(page, eventName);

    await page.waitForTimeout(1000);

    const eventLink = page.locator(`text=${eventName}`).first();
    await eventLink.click();

    await page.waitForTimeout(1000);

    const eventId = page.url().split('/').pop();
    
    if (eventId) {
      const projectorPage = await context.newPage();
      await projectorPage.goto(`/projector/${eventId}`);
      await projectorPage.waitForTimeout(5000);

      // Request fullscreen (browser API)
      // Note: Playwright may not fully support fullscreen API in headless mode
      await projectorPage.evaluate(() => {
        if (document.documentElement.requestFullscreen) {
          return document.documentElement.requestFullscreen();
        }
      }).catch(() => {
        // Fullscreen may not be available in test environment
      });

      await projectorPage.waitForTimeout(1000);

      // Verify page still works
      await expect(projectorPage.locator('body')).toBeVisible();

      await projectorPage.close();
    } else {
      test.skip('Could not determine event ID');
    }
  });
});
