# Testing & Quality Assurance Plan

**Status:** In Progress  
**Priority:** High  
**Timeline:** 2-3 weeks

## 🎯 Goals

1. **Stability**: Ensure all critical features work reliably
2. **Performance**: Verify latency targets (<500ms end-to-end)
3. **Reliability**: Handle edge cases and error scenarios gracefully
4. **Confidence**: Enable safe refactoring and feature additions

---

## 📋 Testing Strategy

### 1. Unit Tests
**Focus:** Individual functions and components in isolation

**Backend:**
- ✅ Matcher service (already exists - custom test runner)
- [ ] Event service (CRUD operations)
- [ ] STT service (error handling, retries)
- [ ] WebSocket message validation (Zod schemas)
- [ ] Rate limiting logic

**Frontend:**
- [ ] Song form validation (Zod schemas)
- [ ] Event form validation
- [ ] Setlist builder logic (reordering, add/remove)
- [ ] Slide cache store (Zustand)
- [ ] WebSocket client (message handling)

### 2. Integration Tests
**Focus:** Multiple components working together

**Backend:**
- [ ] WebSocket protocol (message flow)
- [ ] Session lifecycle (start → audio → match → advance → stop)
- [ ] Supabase integration (event fetching, setlist loading)
- [ ] STT integration (audio → transcription pipeline)

**Frontend:**
- [ ] WebSocket connection flow
- [ ] Event CRUD operations (create → edit → delete)
- [ ] Setlist builder (add songs → reorder → save)
- [ ] Live session flow (start → display updates → stop)

### 3. End-to-End (E2E) Tests
**Focus:** Complete user workflows

**Critical Flows:**
- [ ] Create event → Build setlist → Launch live session
- [ ] Create song → Add to setlist → Start session → Auto-advance slides
- [ ] Operator dashboard → Manual override → Projector sync
- [ ] Error scenarios (network failure, STT error, invalid data)

### 4. Performance Tests
**Focus:** Latency and load handling

- [ ] Latency profiling (audio → transcription → match → display)
- [ ] Load testing (50+ concurrent WebSocket connections)
- [ ] Memory leak detection (long-running sessions)
- [ ] Database query performance (setlist loading, event fetching)

### 5. Visual Regression Tests
**Focus:** UI consistency

- [ ] Component screenshots (before/after changes)
- [ ] Responsive design (mobile, tablet, desktop)
- [ ] Dark mode consistency

---

## 🛠️ Testing Infrastructure Setup

### Backend Testing Framework

**Choice:** Jest (industry standard, great TypeScript support)

**Setup:**
```bash
cd backend
npm install --save-dev jest @types/jest ts-jest
```

**Configuration:** `backend/jest.config.js`
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
```

**Scripts:**
```json
{
  "test": "jest",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage"
}
```

### Frontend Testing Framework

**Choice:** Vitest (fast, Jest-compatible, great Next.js support)

**Setup:**
```bash
cd frontend
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

**Configuration:** `frontend/vitest.config.ts`
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
```

**Scripts:**
```json
{
  "test": "vitest",
  "test:ui": "vitest --ui",
  "test:coverage": "vitest --coverage"
}
```

### E2E Testing Framework

**Choice:** Playwright (modern, fast, reliable)

**Setup:**
```bash
npm install --save-dev @playwright/test
npx playwright install
```

**Configuration:** `playwright.config.ts`
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.TEST_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

---

## 📝 Test Implementation Plan

### Phase 1: Backend Unit Tests (Week 1)

#### Priority 1: Critical Services
1. **Matcher Service** ✅ (already exists, migrate to Jest)
   - [ ] Migrate existing tests to Jest
   - [ ] Add edge case tests (empty inputs, very long buffers)
   - [ ] Add performance tests (timing assertions)

2. **Event Service**
   - [ ] `fetchEventData` - success and error cases
   - [ ] `createEvent` - validation and Supabase integration
   - [ ] `addSongToEvent` - sequence ordering logic
   - [ ] Mock Supabase client for isolation

3. **STT Service**
   - [ ] `transcribeAudioChunk` - success path
   - [ ] Error handling (network failures, invalid audio)
   - [ ] Retry logic (exponential backoff)
   - [ ] Mock STT provider responses

4. **WebSocket Handler**
   - [ ] Message validation (invalid JSON, missing fields)
   - [ ] Rate limiting (exceed limits, reset windows)
   - [ ] Session management (start, stop, cleanup)

#### Priority 2: Utilities & Helpers
- [ ] Zod schema validation
- [ ] Buffer preprocessing (filler word removal, deduplication)
- [ ] Timing utilities

### Phase 2: Frontend Unit Tests (Week 1-2)

#### Priority 1: Core Components
1. **Song Editor Modal**
   - [ ] Form validation (required fields, CCLI optional)
   - [ ] Draft auto-save (localStorage)
   - [ ] Stanza parsing (single vs double newlines)

2. **Setlist Builder**
   - [ ] Add song to setlist
   - [ ] Remove song from setlist
   - [ ] Reorder songs (drag-and-drop simulation)
   - [ ] Sequence order updates

3. **WebSocket Client**
   - [ ] Connection lifecycle (connect, disconnect, reconnect)
   - [ ] Message sending (all message types)
   - [ ] Message receiving (all message types)
   - [ ] Error handling (connection failures)

4. **Slide Cache Store**
   - [ ] Cache setlist
   - [ ] Preload next slides
   - [ ] Get slide by index
   - [ ] Clear cache

#### Priority 2: UI Components
- [ ] EventCard (display, status badges)
- [ ] OperatorHUD (layout, state management)
- [ ] ProjectorDisplay (transitions, formatting)

### Phase 3: Integration Tests (Week 2)

#### Backend Integration
1. **WebSocket Protocol Flow**
   - [ ] START_SESSION → SESSION_STARTED → DISPLAY_UPDATE
   - [ ] AUDIO_DATA → TRANSCRIPT_UPDATE → DISPLAY_UPDATE (match)
   - [ ] MANUAL_OVERRIDE → DISPLAY_UPDATE (broadcast)
   - [ ] STOP_SESSION → SESSION_ENDED

2. **Session Lifecycle**
   - [ ] Start session with event → Load setlist → Initialize matcher
   - [ ] Process audio → Transcribe → Match → Advance slide
   - [ ] Handle song transitions (end of song → next song)
   - [ ] Cleanup on disconnect

3. **Supabase Integration**
   - [ ] Fetch event with setlist (real Supabase test instance)
   - [ ] Handle missing events (error cases)
   - [ ] Handle empty setlists

#### Frontend Integration
1. **Event Management Flow**
   - [ ] Create event → Navigate to detail → Build setlist → Save
   - [ ] Edit event → Update setlist → Verify persistence

2. **Live Session Flow**
   - [ ] Start session → Connect WebSocket → Receive updates
   - [ ] Display updates → Update operator HUD → Update projector
   - [ ] Manual override → Verify sync between views

### Phase 4: E2E Tests (Week 2-3)

#### Critical User Journeys
1. **Complete Event Workflow**
   ```
   Login → Dashboard → Create Event → Add Songs to Setlist 
   → Launch Live → Auto-advance → Stop Session
   ```

2. **Song Management Workflow**
   ```
   Songs Library → Create Song → Edit Lyrics → Save 
   → Add to Event Setlist → Use in Live Session
   ```

3. **Error Recovery**
   ```
   Network Failure → Reconnect → Resume Session
   STT Error → Fallback to Manual → Continue
   ```

### Phase 5: Performance Tests (Week 3)

#### Latency Profiling
- [ ] Measure audio capture → WebSocket send latency
- [ ] Measure STT transcription latency
- [ ] Measure matching algorithm latency
- [ ] Measure display update latency
- [ ] Total end-to-end latency (<500ms target)

#### Load Testing
- [ ] 10 concurrent sessions
- [ ] 25 concurrent sessions
- [ ] 50 concurrent sessions
- [ ] Memory usage monitoring
- [ ] CPU usage monitoring

---

## 📊 Success Metrics

### Coverage Targets
- **Unit Tests:** 70%+ code coverage
- **Integration Tests:** All critical flows covered
- **E2E Tests:** All user journeys covered

### Performance Targets
- **Latency:** <500ms end-to-end (audio → display)
- **Load:** Handle 50+ concurrent connections
- **Memory:** No leaks during 1-hour session
- **CPU:** <50% average during peak load

### Reliability Targets
- **Error Rate:** <1% of requests fail
- **Uptime:** 99.9% availability
- **Recovery:** Auto-recover from 90% of errors

---

## 🚀 Implementation Steps

### Step 1: Setup Testing Infrastructure (Day 1-2)
- [ ] Install Jest for backend
- [ ] Install Vitest for frontend
- [ ] Install Playwright for E2E
- [ ] Configure test environments
- [ ] Add test scripts to package.json

### Step 2: Migrate Existing Tests (Day 2-3)
- [ ] Convert matcher.test.ts to Jest format
- [ ] Verify all tests pass
- [ ] Add missing edge cases

### Step 3: Backend Unit Tests (Day 3-7)
- [ ] Event service tests
- [ ] STT service tests
- [ ] WebSocket handler tests
- [ ] Rate limiting tests

### Step 4: Frontend Unit Tests (Day 7-10)
- [ ] Component tests (Song Editor, Setlist Builder)
- [ ] Hook tests (useWebSocket, useAudioCapture)
- [ ] Store tests (slideCache, authStore)

### Step 5: Integration Tests (Day 10-14)
- [ ] WebSocket protocol tests
- [ ] Session lifecycle tests
- [ ] Supabase integration tests

### Step 6: E2E Tests (Day 14-17)
- [ ] Critical user journeys
- [ ] Error scenarios
- [ ] Cross-browser testing

### Step 7: Performance Tests (Day 17-21)
- [ ] Latency profiling
- [ ] Load testing
- [ ] Memory leak detection

---

## 📝 Test File Structure

```
backend/
  src/
    __tests__/
      unit/
        matcher.test.ts ✅
        eventService.test.ts
        sttService.test.ts
        websocket.test.ts
      integration/
        session.test.ts
        protocol.test.ts
        supabase.test.ts

frontend/
  __tests__/
    unit/
      components/
        SongEditorModal.test.tsx
        SetlistBuilder.test.tsx
        EventForm.test.tsx
      hooks/
        useWebSocket.test.ts
        useAudioCapture.test.ts
      stores/
        slideCache.test.ts
    integration/
      eventFlow.test.tsx
      liveSession.test.tsx

e2e/
  flows/
    completeEventWorkflow.spec.ts
    songManagement.spec.ts
    errorRecovery.spec.ts
  helpers/
    auth.ts
    fixtures.ts

performance/
  latency/
    endToEnd.test.ts
  load/
    concurrentSessions.test.ts
```

---

## 🔍 Testing Best Practices

1. **Isolation**: Each test should be independent
2. **Mocking**: Mock external services (Supabase, STT)
3. **Fixtures**: Use test data fixtures for consistency
4. **Naming**: Descriptive test names (`should advance to next slide when match found`)
5. **AAA Pattern**: Arrange → Act → Assert
6. **Coverage**: Aim for 70%+ but focus on critical paths
7. **Speed**: Keep tests fast (<5s for unit tests)
8. **CI/CD**: Run tests on every commit

---

## 📚 Resources

- [Jest Documentation](https://jestjs.io/)
- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

---

## ✅ Definition of Done

A test is considered complete when:
- [ ] Test passes consistently
- [ ] Test is isolated (no dependencies on other tests)
- [ ] Test has clear, descriptive name
- [ ] Test covers happy path and at least one edge case
- [ ] Test is fast (<1s for unit, <10s for integration)
- [ ] Test is documented (comments for complex scenarios)

---

**Last Updated:** January 25, 2026  
**Next Review:** After Phase 1 completion
