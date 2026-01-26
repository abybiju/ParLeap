# Testing Quick Start Guide

## 🚀 Running Tests

### Backend Tests (Jest)
```bash
cd backend
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage report
```

### Frontend Tests (Vitest)
```bash
cd frontend
npm test                    # Run all tests
npm run test:ui             # UI mode (interactive)
npm run test:coverage       # With coverage report
```

### E2E Tests (Playwright)
```bash
# From root directory
npm run test:e2e            # Run all E2E tests
npm run test:e2e:ui         # UI mode (interactive)
```

### Run All Tests
```bash
# From root directory
npm test                    # Backend + Frontend unit tests
```

---

## 📁 Test File Locations

### Backend
- Unit tests: `backend/src/__tests__/unit/`
- Integration tests: `backend/src/__tests__/integration/`

### Frontend
- Unit tests: `frontend/__tests__/unit/`
- Integration tests: `frontend/__tests__/integration/`

### E2E
- E2E tests: `e2e/flows/`
- Test helpers: `e2e/helpers/`

---

## 📝 Writing Tests

### Backend Example (Jest)
```typescript
import { functionToTest } from '../service';

describe('Service Tests', () => {
  it('should handle success case', () => {
    const result = functionToTest('input');
    expect(result).toBe('expected');
  });

  it('should handle error case', () => {
    expect(() => functionToTest('invalid')).toThrow();
  });
});
```

### Frontend Example (Vitest)
```typescript
import { render, screen } from '@testing-library/react';
import { Component } from './Component';

describe('Component Tests', () => {
  it('should render correctly', () => {
    render(<Component />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### E2E Example (Playwright)
```typescript
import { test, expect } from '@playwright/test';

test('user can create event', async ({ page }) => {
  await page.goto('/dashboard');
  await page.click('text=Create New Event');
  await page.fill('input[name="name"]', 'Test Event');
  await page.click('button[type="submit"]');
  await expect(page.locator('text=Test Event')).toBeVisible();
});
```

---

## 🎯 Coverage Goals

- **Unit Tests:** 70%+ code coverage
- **Integration Tests:** All critical flows covered
- **E2E Tests:** All user journeys covered

---

## 📊 Viewing Coverage Reports

### Backend
```bash
cd backend
npm run test:coverage
# Open: backend/coverage/index.html
```

### Frontend
```bash
cd frontend
npm run test:coverage
# Open: frontend/coverage/index.html
```

---

## 🔧 Troubleshooting

### Tests failing?
1. Check that dependencies are installed: `npm install`
2. Verify environment variables are set
3. Check test logs for specific errors

### E2E tests timing out?
1. Ensure dev servers are running: `npm run dev`
2. Check `TEST_URL` environment variable
3. Increase timeout in `playwright.config.ts`

### Coverage not updating?
1. Clear coverage directory: `rm -rf coverage`
2. Run tests again with coverage flag

---

**See [TESTING_QA_PLAN.md](./TESTING_QA_PLAN.md) for complete testing strategy.**
