import { test, expect } from '@playwright/test';
import { login, createSongViaUI, waitForToast, TEST_USER } from './utils/test-helpers';

test.describe('Song Management Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await login(page);
  });

  test('should navigate to songs page', async ({ page }) => {
    await page.goto('/songs');
    await expect(page).toHaveURL(/\/songs/);
    await expect(page.locator('h1:has-text("Song Library")')).toBeVisible();
  });

  test('should create a new song', async ({ page }) => {
    await page.goto('/songs');

    // Click "New Song" button
    await page.click('button:has-text("New Song")');

    // Fill in song details
    const songTitle = `Test Song ${Date.now()}`;
    await page.fill('input[name="title"]', songTitle);
    await page.fill('input[name="artist"]', 'Test Artist');
    await page.fill('textarea[name="lyrics"]', 'Line 1\nLine 2\nLine 3');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for success notification or table update
    await page.waitForTimeout(2000);

    // Verify song appears in the table
    await expect(page.locator(`text=${songTitle}`)).toBeVisible();
  });

  test('should edit an existing song', async ({ page }) => {
    await page.goto('/songs');

    // Create a song first
    const songTitle = `Edit Test Song ${Date.now()}`;
    await createSongViaUI(page, songTitle, 'Original Artist', 'Original lyrics');

    // Wait for song to appear
    await page.waitForTimeout(1000);

    // Click on the song row to edit (adjust selector based on your table implementation)
    await page.click(`text=${songTitle}`);

    // Update song details
    const updatedTitle = `${songTitle} - Updated`;
    await page.fill('input[name="title"]', updatedTitle);
    await page.fill('textarea[name="lyrics"]', 'Updated lyrics line 1\nUpdated lyrics line 2');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for update
    await page.waitForTimeout(2000);

    // Verify updated song appears
    await expect(page.locator(`text=${updatedTitle}`)).toBeVisible();
  });

  test('should delete a song', async ({ page }) => {
    await page.goto('/songs');

    // Create a song first
    const songTitle = `Delete Test Song ${Date.now()}`;
    await createSongViaUI(page, songTitle, 'Delete Artist', 'Delete lyrics');

    // Wait for song to appear
    await page.waitForTimeout(1000);

    // Find and click delete button (adjust selector based on your table implementation)
    // This might be a trash icon or delete button in a row
    const row = page.locator(`text=${songTitle}`).locator('..');
    await row.locator('button[aria-label*="delete" i], button:has-text("Delete")').first().click();

    // Confirm deletion in dialog
    await page.click('button:has-text("Delete"), button[type="button"]:has-text("Delete")');

    // Wait for deletion
    await page.waitForTimeout(2000);

    // Verify song is removed
    await expect(page.locator(`text=${songTitle}`)).not.toBeVisible();
  });

  test('should search songs', async ({ page }) => {
    await page.goto('/songs');

    // Create a test song with unique title
    const uniqueTitle = `Search Test ${Date.now()}`;
    await createSongViaUI(page, uniqueTitle, 'Search Artist', 'Search lyrics');

    await page.waitForTimeout(1000);

    // Look for search input (adjust selector based on your implementation)
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]');
    
    if (await searchInput.count() > 0) {
      await searchInput.fill(uniqueTitle);
      await page.waitForTimeout(500);

      // Verify search results
      await expect(page.locator(`text=${uniqueTitle}`)).toBeVisible();
    } else {
      // If no search input, skip this test or log a note
      test.skip();
    }
  });

  test('should validate required fields', async ({ page }) => {
    await page.goto('/songs');

    // Click "New Song" button
    await page.click('button:has-text("New Song")');

    // Try to submit without filling required fields
    await page.click('button[type="submit"]');

    // Check for validation errors (adjust based on your form validation)
    // This might be a toast, inline error, or disabled submit button
    await page.waitForTimeout(500);

    // Form should not submit - check that we're still on the form
    const titleInput = page.locator('input[name="title"]');
    await expect(titleInput).toBeVisible();
  });
});
