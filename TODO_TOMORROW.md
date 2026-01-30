# Tomorrow's Tasks - Hum-to-Search Completion

**Date:** January 30, 2026  
**Status:** Ready to test and deploy

## Immediate Actions

### 1. Push Latest Commits
```bash
git add backend/src/index.ts
git commit -m "fix: Add type assertion for job.result to fix TypeScript error"
git push origin main
```

**What this fixes:**
- TypeScript error: `Property 'length' does not exist on type '{}'`
- CI will pass after this push

### 2. Verify Deployment
- Check GitHub Actions CI passes
- Verify Vercel auto-deploys frontend
- Verify Railway auto-deploys backend
- Check Railway logs for any startup errors

### 3. Test End-to-End

**Test Flow:**
1. Go to `www.parleap.com/songs`
2. Click microphone button 🎤
3. Hum "Amazing Grace" for 3-5 seconds
4. Click "Stop & Search"
5. Watch for "Analyzing melody..." spinner
6. Wait for results (may take 30-60 seconds)

**What to Check:**
- Browser console (F12) - Look for `[HumSearch]` logs
- Railway backend logs - Check for processing times
- Verify job queue creates jobs
- Verify polling works
- Verify results appear

## Known Issues to Monitor

### BasicPitch Performance
- **Expected:** 30-60 seconds for 5 seconds of audio
- **Why:** Pure JS TensorFlow.js (no GPU)
- **Impact:** User waits, but async prevents timeout
- **Action:** Monitor logs, consider optimizations if needed

### Job Queue Limitations
- **Current:** In-memory (lost on restart)
- **Impact:** Jobs lost if Railway restarts during processing
- **Future:** Consider Redis or database-backed queue

## If It Still Doesn't Work

### Check Railway Logs For:
1. Model loading errors
2. BasicPitch initialization failures
3. Processing times
4. Any errors during inference

### Check Browser Console For:
1. Network errors (CORS, 404, 500)
2. Polling errors
3. Response parsing errors

### Potential Solutions:
1. **If BasicPitch fails to load:**
   - Check model path in Railway
   - Verify `@spotify/basic-pitch` is installed
   - Check file:// fetch polyfill works

2. **If processing is too slow:**
   - Consider reducing audio quality further
   - Or implement faster pitch detection
   - Or use GPU-accelerated TensorFlow (if Railway supports)

3. **If polling fails:**
   - Check job ID format
   - Verify job status endpoint works
   - Check CORS headers

---

## Backup Plan: User's Research Approach

**If async processing still doesn't work, implement the research plan:**

### Alternative Architecture (Fastify Server)

**Objective:** Convert backend to a lightweight Fastify API server that handles audio uploads and returns song matches.

**Steps:**

1. **Install Server Dependencies:**
   ```bash
   cd backend
   npm install fastify @fastify/multipart @fastify/cors
   ```

2. **Create Server (`backend/src/server.ts`):**
   - Run on Port 3001 (or Railway's PORT)
   - Enable CORS for frontend
   - Route: `POST /search/hum`
   - Accept `.wav` or `.webm` file uploads
   - Convert to Buffer
   - Call `MelodyService.getMelodyVector(buffer)`
   - Call Supabase RPC `match_songs()`
   - Return JSON results

3. **Update package.json:**
   ```json
   "start": "tsx src/server.ts"
   ```

4. **Update Frontend:**
   - Use `FormData` to send file directly
   - POST to `http://localhost:3001/search/hum` (or production URL)
   - Handle response

5. **Include Polyfill:**
   - Add same `file://` fetch polyfill from `melodyService.ts`
   - Prevents Node 24 crash

**Why This Might Help:**
- Fastify is faster than Express for file uploads
- Multipart handling might be more efficient
- Simpler request/response pattern
- Could isolate the heavy processing better

**Note:** This approach doesn't solve BasicPitch slowness, but might handle file uploads better and simplify the architecture.

## Files to Review Tomorrow

- `HUM_SEARCH_STATUS.md` - Complete status document
- `memory/2026-01-29.md` - Today's detailed notes
- Railway deployment logs
- Browser console logs

## Success Criteria

✅ Hum search works end-to-end  
✅ Results appear within 60 seconds  
✅ No timeout errors  
✅ User sees progress feedback  
✅ Results match expected songs

## Next Phase (If Working)

1. Add more songs to database (ingest more WAV files)
2. Optimize performance (if needed)
3. Add user feedback improvements
4. Consider production queue system (Redis)
