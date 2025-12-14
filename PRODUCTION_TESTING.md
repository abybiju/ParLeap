# Production Testing Guide - Latency Attack Features

## 🚀 Deployment Status

**Frontend (Vercel):** Auto-deploying from GitHub push
- URL: https://par-leap.vercel.app
- Test Page: https://par-leap.vercel.app/test-websocket

**Backend (Railway):** Auto-deploying from GitHub push
- URL: https://parleapbackend-production.up.railway.app
- WebSocket: `wss://parleapbackend-production.up.railway.app`

---

## ✅ Testing Checklist

### 1. Verify Deployments

**Frontend:**
- [ ] Visit https://par-leap.vercel.app/test-websocket
- [ ] Page loads without errors
- [ ] WebSocket test component is visible

**Backend:**
- [ ] Visit https://parleapbackend-production.up.railway.app/health
- [ ] Should return: `{"status":"ok","timestamp":"...","activeSessions":0}`

---

### 2. Test WebSocket Connection

**Steps:**
1. Go to https://par-leap.vercel.app/test-websocket
2. Click **"Connect"** button
3. Verify connection status changes to **"CONNECTED"** (green badge)

**Expected:**
- Connection status badge shows "CONNECTED"
- ConnectionStatus component shows RTT (e.g., "45ms avg")
- No errors in browser console

---

### 3. Test RTT Monitoring (Panic Protocol)

**Steps:**
1. After connecting, wait 5-10 seconds
2. Observe the **ConnectionStatus** component in the top-right

**Expected:**
- RTT value displayed (e.g., "45ms avg")
- Green connection indicator dot
- RTT updates every 5 seconds (automatic PING/PONG)

**Test Degraded Mode:**
- Use browser DevTools → Network → Throttling
- Set to "Slow 3G" or "Fast 3G"
- Wait 10-15 seconds
- **Expected:** Weak Signal badge appears (amber, pulsing) when RTT > 500ms

---

### 4. Test Latenc-o-meter (Dev Tool)

**Steps:**
1. Connect WebSocket
2. Look for **Latenc-o-meter** overlay in bottom-right corner
3. Click **START_SESSION** button
4. Observe latency metrics

**Expected:**
- Latenc-o-meter shows:
  - Mic → Network: ~0-50ms
  - Network → Server: ~20-100ms
  - AI Processing: ~1-50ms (mock data)
  - Server → Client: ~20-100ms
  - **Total: <500ms** (goal)
- Metrics update in real-time
- Color coding: Green (< threshold), Yellow (near threshold), Red (> threshold)

**Note:** Latenc-o-meter only appears in development mode. If you don't see it, check that `NODE_ENV=development` in Vercel (or it won't show in production).

---

### 5. Test Ghost Text (Confidence Monitor)

**Steps:**
1. Connect WebSocket
2. Click **START_SESSION**
3. Look for **Ghost Text** section below message history

**Expected:**
- Ghost Text component appears when connected
- Shows "What the AI hears..." placeholder
- When `TRANSCRIPT_UPDATE` messages arrive, displays transcription text
- Confidence percentage shown (if available)
- Highlight animation on high-confidence matches

**Note:** Currently shows mock data. Real transcription will appear when STT provider is integrated.

---

### 6. Test Slide Caching & Preloading

**Steps:**
1. Connect WebSocket
2. Click **START_SESSION**
3. Check browser DevTools → Application → Local Storage
4. Navigate slides using **NEXT_SLIDE** and **PREV_SLIDE** buttons

**Expected:**
- `SESSION_STARTED` message includes `setlist` array with all songs
- Setlist cached in Zustand store (check React DevTools)
- Next 3 slides preloaded automatically
- Slide navigation is instant (no server delay)

**Verify Caching:**
- Open browser console
- Type: `window.__ZUSTAND_STORE__` (if available) or check React DevTools
- Should see `slideCache` store with `setlist` and `preloadedSlides`

---

### 7. Test Timing Metadata

**Steps:**
1. Connect WebSocket
2. Click **START_SESSION**
3. Check message history for `SESSION_STARTED` message
4. Expand the message JSON

**Expected:**
- Message includes `timing` object:
  ```json
  {
    "timing": {
      "serverReceivedAt": 1234567890,
      "serverSentAt": 1234567891,
      "processingTimeMs": 1
    }
  }
  ```
- All server messages include timing metadata
- Latenc-o-meter uses this data for calculations

---

### 8. Test Manual Override (Slide Navigation)

**Steps:**
1. Connect WebSocket
2. Click **START_SESSION**
3. Click **NEXT_SLIDE** button
4. Click **PREV_SLIDE** button

**Expected:**
- `DISPLAY_UPDATE` messages arrive immediately
- Message history shows slide changes
- No duplicate `DISPLAY_UPDATE` messages
- Timing metadata included in each message
- Slide cache updates automatically

---

### 9. Test Session Management

**Steps:**
1. Connect WebSocket
2. Click **START_SESSION**
3. Click **STOP_SESSION**
4. Click **PING** (should work anytime)

**Expected:**
- `SESSION_STARTED` message received
- `SESSION_ENDED` message received on stop
- `PONG` message received for each PING
- All messages include timing metadata
- Connection remains open after STOP_SESSION

---

### 10. Test Error Handling

**Steps:**
1. Connect WebSocket
2. Click **STOP_SESSION** (without starting session)
3. Try to navigate slides without session

**Expected:**
- Error messages displayed in message history
- Error messages include timing metadata
- Connection remains stable
- No crashes or unhandled errors

---

## 🐛 Troubleshooting

### Latenc-o-meter Not Showing
- **Cause:** Only visible in development mode
- **Fix:** Check Vercel environment variables - `NODE_ENV` should be `development` for dev tool to show
- **Note:** In production, this is expected behavior (dev tools hidden)

### WebSocket Connection Fails
- **Check:** Vercel environment variable `NEXT_PUBLIC_WS_URL` is set to `wss://parleapbackend-production.up.railway.app`
- **Check:** Railway backend is running (visit `/health` endpoint)
- **Check:** CORS is configured correctly in Railway (should allow Vercel domain)

### RTT Not Updating
- **Wait:** RTT updates every 5 seconds (automatic PING interval)
- **Check:** Connection is actually connected (green badge)
- **Check:** Browser console for errors

### Ghost Text Not Showing
- **Check:** WebSocket is connected
- **Check:** `TRANSCRIPT_UPDATE` messages are being received
- **Note:** Currently shows mock data until STT provider is integrated

### Slide Cache Not Working
- **Check:** `SESSION_STARTED` message includes `setlist` array
- **Check:** Browser console for errors
- **Check:** React DevTools → Components → useSlideCache hook

---

## 📊 Success Criteria

**All features working if:**
- ✅ WebSocket connects successfully
- ✅ RTT monitoring shows values and updates every 5s
- ✅ Weak Signal badge appears when network is slow
- ✅ Latenc-o-meter shows latency breakdown (dev mode)
- ✅ Ghost Text displays transcription updates
- ✅ Slide navigation works smoothly
- ✅ All messages include timing metadata
- ✅ No console errors
- ✅ Total latency < 500ms (goal)

---

## 📝 Test Results Template

```
Date: ___________
Tester: ___________

Connection: ✅ / ❌
RTT Monitoring: ✅ / ❌ (Value: ____ms)
Weak Signal Badge: ✅ / ❌ (Triggered at: ____ms)
Latenc-o-meter: ✅ / ❌ (Total: ____ms)
Ghost Text: ✅ / ❌
Slide Caching: ✅ / ❌
Timing Metadata: ✅ / ❌
Manual Override: ✅ / ❌
Error Handling: ✅ / ❌

Issues Found:
- 

Notes:
- 
```

---

## 🎯 Next Steps After Testing

1. **If all tests pass:** Proceed to integrate STT provider
2. **If issues found:** Document and fix before proceeding
3. **Performance baseline:** Record latency metrics for future optimization

---

**Last Updated:** December 13, 2025

