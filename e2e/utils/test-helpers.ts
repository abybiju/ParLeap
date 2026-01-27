import { Page, expect } from '@playwright/test';

/**
 * Test Helpers for E2E Tests
 * 
 * Common utilities for E2E testing
 */

export interface TestUser {
  email: string;
  password: string;
}

/**
 * Default test user credentials
 * These should match your test environment setup
 */
export const TEST_USER: TestUser = {
  email: process.env.TEST_USER_EMAIL || 'test@example.com',
  password: process.env.TEST_USER_PASSWORD || 'testpassword123',
};

/**
 * Login helper - navigates to login page and signs in
 */
export async function login(page: Page, user: TestUser = TEST_USER): Promise<void> {
  await page.goto('/auth/login');
  await page.fill('input[name="email"]', user.email);
  await page.fill('input[name="password"]', user.password);
  await page.click('button[type="submit"]');
  
  // Wait for navigation to dashboard
  await page.waitForURL('/dashboard', { timeout: 10000 });
}

/**
 * Wait for WebSocket connection to be established
 */
export async function waitForWebSocketConnection(page: Page, timeout = 10000): Promise<void> {
  // Check for connection indicator or wait for WebSocket to be ready
  // This is a placeholder - adjust based on your actual UI indicators
  await page.waitForSelector('text=/connected|CONNECTED/i', { timeout }).catch(() => {
    // If no indicator, just wait a bit for connection to establish
    return page.waitForTimeout(2000);
  });
}

/**
 * Create a test song via UI
 */
export async function createSongViaUI(
  page: Page,
  title: string,
  artist?: string,
  lyrics?: string
): Promise<void> {
  // Navigate to songs page if not already there
  if (!page.url().includes('/songs')) {
    await page.goto('/songs');
  }

  // Click "New Song" button
  await page.click('button:has-text("New Song")');

  // Fill in song details
  await page.fill('input[name="title"]', title);
  if (artist) {
    await page.fill('input[name="artist"]', artist);
  }
  if (lyrics) {
    await page.fill('textarea[name="lyrics"]', lyrics);
  }

  // Submit form
  await page.click('button[type="submit"]');

  // Wait for success (adjust selector based on your toast/notification system)
  await page.waitForTimeout(1000);
}

/**
 * Create a test event via UI
 */
export async function createEventViaUI(
  page: Page,
  name: string,
  eventDate?: string
): Promise<void> {
  // Navigate to events page if not already there
  if (!page.url().includes('/events')) {
    await page.goto('/events');
  }

  // Click "New Event" button
  await page.click('a:has-text("New Event"), button:has-text("New Event")');

  // Fill in event details
  await page.fill('input[name="name"]', name);
  if (eventDate) {
    await page.fill('input[type="date"]', eventDate);
  }

  // Submit form
  await page.click('button[type="submit"]');

  // Wait for navigation or success
  await page.waitForTimeout(1000);
}

/**
 * Wait for toast notification
 */
export async function waitForToast(page: Page, message?: string): Promise<void> {
  // Adjust selector based on your toast library (sonner, react-hot-toast, etc.)
  if (message) {
    await page.waitForSelector(`text=${message}`, { timeout: 5000 });
  } else {
    // Just wait for any toast to appear
    await page.waitForSelector('[role="status"], [data-sonner-toast]', { timeout: 5000 });
  }
}

/**
 * Mock WebSocket messages for testing
 */
export async function mockWebSocketMessage(
  page: Page,
  message: Record<string, unknown>
): Promise<void> {
  await page.evaluate((msg) => {
    // Dispatch a custom event that your WebSocket hook listens to
    window.dispatchEvent(new CustomEvent('mock-websocket-message', { detail: msg }));
  }, message);
}

/**
 * Check if element is visible (with retry logic)
 */
export async function expectVisible(
  page: Page,
  selector: string,
  timeout = 5000
): Promise<void> {
  await expect(page.locator(selector)).toBeVisible({ timeout });
}

/**
 * Wait for page to be fully loaded
 */
export async function waitForPageLoad(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.waitForLoadState('domcontentloaded');
}
