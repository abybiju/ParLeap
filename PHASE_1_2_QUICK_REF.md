# Phase 1.2 Quick Reference Card

**Date:** December 14, 2025  
**Status:** ✅ Implementation Complete  

---

## 🚀 Start Here: 5-Minute Quick Start

```bash
# 1. Create .env files (copy templates from PHASE_1_2_GUIDE.md)
# 2. Run database migration in Supabase SQL Editor
# 3. Seed test data
cd backend && npx ts-node src/utils/seedDatabase.ts

# 4. Start servers
Terminal 1: cd backend && npm run dev
Terminal 2: cd frontend && npm run dev

# 5. Test
Open: http://localhost:3000/test-websocket
Enter Event ID from seed output
Click "Start Session"
```

---

## 📁 What Changed

| File | Status | Purpose |
|------|--------|---------|
| `eventService.ts` | ✅ NEW | Supabase queries |
| `seedDatabase.ts` | ✅ NEW | Test data |
| `handler.ts` | ✅ UPDATED | Real data fetching |
| `PHASE_1_2_GUIDE.md` | ✅ NEW | Complete guide |

---

## 🔑 Environment Variables

**Backend (.env):**
```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

**Frontend (.env.local):**
```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Get from Supabase: Settings → API

---

## 🎯 Key Functions

```typescript
// Main function - fetch complete event
fetchEventData(eventId): Promise<EventData | null>

// Create test data
npm run seed-db

// Test WebSocket
http://localhost:3000/test-websocket
```

---

## ✅ Success Criteria

- [ ] Supabase project created
- [ ] Environment variables configured
- [ ] Database migration run
- [ ] Seed script executed
- [ ] Servers started without errors
- [ ] WebSocket loads real event data
- [ ] First lyric line displays
- [ ] No console errors

---

## 🐛 Quick Fixes

| Issue | Solution |
|-------|----------|
| "not set" error | Add to .env file |
| Event not found | Run seed script |
| RLS violation | Use SERVICE_ROLE_KEY in backend |
| Tables missing | Run migration in Supabase SQL Editor |

---

## 📞 Support

- **Setup Help:** `PHASE_1_2_GUIDE.md`
- **Code Questions:** Check `eventService.ts`
- **Architecture:** `PHASE_1_2_SUMMARY.md`
- **Visual Overview:** `PHASE_1_2_VISUAL.txt`

---

## 🎓 Next Phase

After Phase 1.2: Phase 2.3 (Audio Capture)

- Browser microphone
- Audio streaming
- Visual feedback

---

**Questions?** See `PHASE_1_2_GUIDE.md` (full guide)

