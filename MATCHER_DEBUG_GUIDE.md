# Matcher Debug Guide - Why MatchStatus Isn't Showing

**Problem**: MatchStatus component not appearing even though GhostText shows transcriptions.

**Root Cause**: MatchStatus only appears when backend sends `DISPLAY_UPDATE` with `matchConfidence`, which only happens when:
- Match is found
- Confidence > similarity threshold (default: 0.7)

---

## 🔍 Step 1: Enable Debug Logging

### Railway Backend Environment Variables

1. Go to Railway Dashboard → Your Backend Service → Variables
2. Add/Update:
   ```
   DEBUG_MATCHER=true
   ```
3. Redeploy backend

### Check Railway Logs

1. Go to Railway → Deployments → Latest → Deploy Logs
2. Look for matcher debug messages:
   - `[MATCHER] Starting match with cleaned buffer: "..."`
   - `[MATCHER] Buffer too short: X < 3` (if buffer is too short)
   - `[MATCHER] Line X: "..." → Y%`
   - `[WS] 🎯 MATCH FOUND: Line X @ Y%`

---

## 🔧 Step 2: Lower Similarity Threshold (Temporary)

If matches are being found but below 0.7 threshold:

1. Railway → Variables → Add/Update:
   ```
   MATCHER_SIMILARITY_THRESHOLD=0.5
   ```
2. Redeploy backend
3. Test again - MatchStatus should appear more easily

---

## 🔍 Step 3: Verify Partial Matching is Enabled

Check Railway Variables:
```
MATCHER_ALLOW_PARTIAL=true
```

If not set, add it and redeploy.

---

## 📊 What to Look For in Logs

### Good Signs (Matcher Working):
```
[MATCHER] Starting match with cleaned buffer: "amazing grace how sweet"
[MATCHER] Line 0: "amazing grace how sweet the sound" → 85.2%
[WS] 🎯 MATCH FOUND: Line 0 @ 85.2% - "Amazing grace how sweet the sound"
```

### Problem Signs:

**Buffer Too Short:**
```
[MATCHER] Buffer too short: 2 < 3
```
**Fix**: Speak longer phrases or lower `MATCHER_MIN_BUFFER_LENGTH`

**No Match Found:**
```
[MATCHER] ❌ No match (best: 45.3%)
```
**Fix**: Lower `MATCHER_SIMILARITY_THRESHOLD` or check if lyrics match what you're saying

**Matcher Not Running:**
No `[MATCHER]` logs at all
**Fix**: Check `MATCHER_ALLOW_PARTIAL=true` and ensure backend has latest code

---

## 🎯 Quick Fix: Lower Threshold Temporarily

To see MatchStatus immediately:

1. Railway Variables:
   ```
   MATCHER_SIMILARITY_THRESHOLD=0.5
   MATCHER_ALLOW_PARTIAL=true
   DEBUG_MATCHER=true
   ```

2. Redeploy backend

3. Test:
   - Speak: "Amazing grace how sweet the sound"
   - Should see MatchStatus appear with confidence

---

## ✅ Expected Behavior

When working correctly:
1. You speak → TRANSCRIPT_UPDATE appears
2. Matcher runs → Finds match
3. DISPLAY_UPDATE sent with `matchConfidence`
4. MatchStatus component appears showing confidence %

---

**After enabling debug, check Railway logs and share what you see!**
