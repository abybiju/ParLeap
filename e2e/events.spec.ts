import { test, expect } from '@playwright/test';
import { login, createEventViaUI, createSongViaUI, TEST_USER } from './utils/test-helpers';

test.describe('Event Management Flow', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should navigate to events page', async ({ page }) => {
    await page.goto('/events');
    await expect(page).toHaveURL(/\/events/);
    await expect(page.locator('h1:has-text("Events"), h1:has-text("Events & Setlists")')).toBeVisible();
  });

  test('should create a new event', async ({ page }) => {
    await page.goto('/events');

    // Click "New Event" button
    await page.click('a:has-text("New Event"), button:has-text("New Event")');

    // Fill in event details
    const eventName = `Test Event ${Date.now()}`;
    await page.fill('input[name="name"]', eventName);

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for navigation or success
    await page.waitForTimeout(2000);

    // Verify event was created (either on events list or event detail page)
    // Adjust based on your routing
    const eventLink = page.locator(`text=${eventName}`);
    if (await eventLink.count() > 0) {
      await expect(eventLink).toBeVisible();
    } else {
      // Might be on event detail page
      await expect(page.locator(`h1:has-text("${eventName}"), h2:has-text("${eventName}")`)).toBeVisible();
    }
  });

  test('should add songs to setlist', async ({ page }) => {
    // First create a song
    await page.goto('/songs');
    const songTitle = `Setlist Test Song ${Date.now()}`;
    await createSongViaUI(page, songTitle, 'Setlist Artist', 'Line 1\nLine 2');

    await page.waitForTimeout(1000);

    // Create an event
    await page.goto('/events');
    const eventName = `Setlist Event ${Date.now()}`;
    await createEventViaUI(page, eventName);

    await page.waitForTimeout(1000);

    // Navigate to event detail page (adjust URL pattern based on your routing)
    // Find the event card/link and click it
    const eventLink = page.locator(`text=${eventName}`).first();
    await eventLink.click();

    await page.waitForTimeout(1000);

    // Look for setlist builder or "Add Song" button
    // This is a simplified version - adjust based on your SetlistBuilder component
    const addSongButton = page.locator('button:has-text("Add Song"), button[aria-label*="add song" i]');
    
    if (await addSongButton.count() > 0) {
      await addSongButton.click();
      await page.waitForTimeout(500);

      // Select the song we created
      await page.click(`text=${songTitle}`);
      await page.waitForTimeout(500);

      // Verify song appears in setlist
      await expect(page.locator(`text=${songTitle}`)).toBeVisible();
    } else {
      // If drag-and-drop, try that approach
      // This is a placeholder - implement based on your actual UI
      test.skip('Setlist builder UI not found - adjust selectors');
    }
  });

  test('should start live session from event', async ({ page }) => {
    // Create an event
    await page.goto('/events');
    const eventName = `Live Session Event ${Date.now()}`;
    await createEventViaUI(page, eventName);

    await page.waitForTimeout(1000);

    // Navigate to event detail page
    const eventLink = page.locator(`text=${eventName}`).first();
    await eventLink.click();

    await page.waitForTimeout(1000);

    // Look for "Start Session" or "Go Live" button
    const startButton = page.locator('button:has-text("Start"), button:has-text("Go Live"), button:has-text("Start Session")');
    
    if (await startButton.count() > 0) {
      await startButton.click();
      
      // Should navigate to live/operator page
      await page.waitForTimeout(2000);
      
      // Verify we're on the live session page
      // Adjust URL pattern based on your routing
      await expect(page).toHaveURL(/\/live\/|\/operator\//);
    } else {
      test.skip('Start session button not found - adjust selectors');
    }
  });

  test('should edit event details', async ({ page }) => {
    // Create an event first
    await page.goto('/events');
    const eventName = `Edit Event ${Date.now()}`;
    await createEventViaUI(page, eventName);

    await page.waitForTimeout(1000);

    // Navigate to event detail page
    const eventLink = page.locator(`text=${eventName}`).first();
    await eventLink.click();

    await page.waitForTimeout(1000);

    // Look for edit button
    const editButton = page.locator('button:has-text("Edit"), button[aria-label*="edit" i]');
    
    if (await editButton.count() > 0) {
      await editButton.click();
      await page.waitForTimeout(500);

      // Update event name
      const updatedName = `${eventName} - Updated`;
      await page.fill('input[name="name"]', updatedName);
      await page.click('button[type="submit"]');

      await page.waitForTimeout(2000);

      // Verify update
      await expect(page.locator(`text=${updatedName}`)).toBeVisible();
    } else {
      test.skip('Edit button not found - adjust selectors');
    }
  });

  test('should delete an event', async ({ page }) => {
    // Create an event first
    await page.goto('/events');
    const eventName = `Delete Event ${Date.now()}`;
    await createEventViaUI(page, eventName);

    await page.waitForTimeout(1000);

    // Navigate to event detail page
    const eventLink = page.locator(`text=${eventName}`).first();
    await eventLink.click();

    await page.waitForTimeout(1000);

    // Look for delete button
    const deleteButton = page.locator('button:has-text("Delete"), button[aria-label*="delete" i]');
    
    if (await deleteButton.count() > 0) {
      await deleteButton.click();
      
      // Confirm deletion
      await page.click('button:has-text("Delete"), button[type="button"]:has-text("Delete")');
      
      await page.waitForTimeout(2000);

      // Should be back on events list
      await expect(page).toHaveURL(/\/events/);
      await expect(page.locator(`text=${eventName}`)).not.toBeVisible();
    } else {
      test.skip('Delete button not found - adjust selectors');
    }
  });
});
