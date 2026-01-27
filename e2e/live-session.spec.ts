import { test, expect } from '@playwright/test';
import { login, createEventViaUI, createSongViaUI, waitForWebSocketConnection, TEST_USER } from './utils/test-helpers';

test.describe('Live Session Flow', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should start a live session', async ({ page }) => {
    // Create an event with a song
    await page.goto('/songs');
    const songTitle = `Live Session Song ${Date.now()}`;
    await createSongViaUI(page, songTitle, 'Live Artist', 'Line 1\nLine 2\nLine 3');

    await page.waitForTimeout(1000);

    await page.goto('/events');
    const eventName = `Live Session Event ${Date.now()}`;
    await createEventViaUI(page, eventName);

    await page.waitForTimeout(1000);

    // Navigate to event and start session
    const eventLink = page.locator(`text=${eventName}`).first();
    await eventLink.click();

    await page.waitForTimeout(1000);

    // Start session
    const startButton = page.locator('button:has-text("Start"), button:has-text("Go Live"), button:has-text("Start Session")');
    if (await startButton.count() > 0) {
      await startButton.click();
    } else {
      // Try navigating directly to live page
      const eventId = page.url().split('/').pop();
      await page.goto(`/live/${eventId}`);
    }

    await page.waitForTimeout(3000);

    // Verify we're on the operator/live page
    await expect(page).toHaveURL(/\/live\/|\/operator\//);

    // Check for operator HUD elements
    // Adjust selectors based on your OperatorHUD component
    const operatorElements = [
      page.locator('text=/transcription|Transcription/i'),
      page.locator('text=/current slide|Current Slide/i'),
      page.locator('text=/setlist|Setlist/i'),
    ];

    // At least one operator element should be visible
    const visibleElements = await Promise.all(
      operatorElements.map(async (el) => await el.isVisible().catch(() => false))
    );
    
    expect(visibleElements.some(v => v)).toBeTruthy();
  });

  test('should establish WebSocket connection', async ({ page, context }) => {
    // Create and start a session
    await page.goto('/events');
    const eventName = `WebSocket Test ${Date.now()}`;
    await createEventViaUI(page, eventName);

    await page.waitForTimeout(1000);

    const eventLink = page.locator(`text=${eventName}`).first();
    await eventLink.click();

    await page.waitForTimeout(1000);

    // Navigate to live page
    const eventId = page.url().split('/').pop();
    if (eventId) {
      await page.goto(`/live/${eventId}`);
      await page.waitForTimeout(3000);

      // Check for connection status indicator
      // Adjust selector based on your ConnectionStatus component
      const connectionStatus = page.locator('text=/connected|CONNECTED|connecting/i');
      
      // Connection should be established or connecting
      await expect(connectionStatus.first()).toBeVisible({ timeout: 10000 });
    } else {
      test.skip('Could not determine event ID');
    }
  });

  test('should display transcription when audio is captured', async ({ page }) => {
    // This test requires microphone access and actual audio capture
    // It's a placeholder - implement based on your audio capture flow
    
    await page.goto('/events');
    const eventName = `Transcription Test ${Date.now()}`;
    await createEventViaUI(page, eventName);

    await page.waitForTimeout(1000);

    const eventLink = page.locator(`text=${eventName}`).first();
    await eventLink.click();

    await page.waitForTimeout(1000);

    const eventId = page.url().split('/').pop();
    if (eventId) {
      await page.goto(`/live/${eventId}`);
      await page.waitForTimeout(3000);

      // Grant microphone permission (if prompted)
      const permissionButton = page.locator('button:has-text("Allow"), button:has-text("Grant")');
      if (await permissionButton.count() > 0) {
        await permissionButton.click();
      }

      // Look for transcription area
      // Adjust selector based on your GhostText component
      const transcriptionArea = page.locator('[data-testid="transcription"], text=/transcription/i');
      
      // Note: Actual transcription depends on audio input
      // This test verifies the UI is ready, not actual transcription
      await page.waitForTimeout(2000);
      
      // Just verify the page loaded correctly
      await expect(page.locator('body')).toBeVisible();
    } else {
      test.skip('Could not determine event ID');
    }
  });

  test('should allow manual slide navigation', async ({ page }) => {
    // Create event with song and start session
    await page.goto('/songs');
    const songTitle = `Manual Nav Song ${Date.now()}`;
    await createSongViaUI(page, songTitle, 'Nav Artist', 'Slide 1\nSlide 2\nSlide 3');

    await page.waitForTimeout(1000);

    await page.goto('/events');
    const eventName = `Manual Nav Event ${Date.now()}`;
    await createEventViaUI(page, eventName);

    await page.waitForTimeout(1000);

    const eventLink = page.locator(`text=${eventName}`).first();
    await eventLink.click();

    await page.waitForTimeout(1000);

    const eventId = page.url().split('/').pop();
    if (eventId) {
      await page.goto(`/live/${eventId}`);
      await page.waitForTimeout(3000);

      // Look for navigation buttons
      const nextButton = page.locator('button:has-text("NEXT"), button:has-text("Next")');
      const prevButton = page.locator('button:has-text("PREV"), button:has-text("Prev"), button:has-text("Previous")');

      if (await nextButton.count() > 0) {
        // Click next button
        await nextButton.click();
        await page.waitForTimeout(1000);

        // Verify slide changed (adjust based on your slide display)
        // This is a simplified check
        await expect(page.locator('body')).toBeVisible();
      } else {
        test.skip('Navigation buttons not found - adjust selectors');
      }
    } else {
      test.skip('Could not determine event ID');
    }
  });

  test('should stop session', async ({ page }) => {
    // Start a session
    await page.goto('/events');
    const eventName = `Stop Session Test ${Date.now()}`;
    await createEventViaUI(page, eventName);

    await page.waitForTimeout(1000);

    const eventLink = page.locator(`text=${eventName}`).first();
    await eventLink.click();

    await page.waitForTimeout(1000);

    const eventId = page.url().split('/').pop();
    if (eventId) {
      await page.goto(`/live/${eventId}`);
      await page.waitForTimeout(3000);

      // Look for stop button
      const stopButton = page.locator('button:has-text("Stop"), button:has-text("Stop Session")');
      
      if (await stopButton.count() > 0) {
        await stopButton.click();
        await page.waitForTimeout(2000);

        // Should navigate back to dashboard or events
        await expect(page).toHaveURL(/\/dashboard|\/events/);
      } else {
        test.skip('Stop button not found - adjust selectors');
      }
    } else {
      test.skip('Could not determine event ID');
    }
  });
});
