# Supabase Migration 002 - Add CCLI Number Column

## Critical: This Migration Must Be Run in Production

**Date**: January 25, 2026  
**Migration File**: `supabase/migrations/002_add_ccli_number.sql`  
**Status**: ⚠️ **NOT YET APPLIED TO PRODUCTION**

---

## Error You're Seeing

```
Could not find the 'ccli_number' column of 'songs' in the schema cache
```

This error occurs because the `ccli_number` column doesn't exist in your production Supabase database yet.

---

## How to Apply This Migration

### Option 1: Using Supabase Dashboard (Recommended)

1. **Go to your Supabase Dashboard**
   - Visit: https://supabase.com/dashboard
   - Select your ParLeap project

2. **Open SQL Editor**
   - Click on **"SQL Editor"** in the left sidebar
   - Click **"New query"**

3. **Copy and Paste the Migration SQL**
   ```sql
   -- Add CCLI number field to songs table
   ALTER TABLE songs ADD COLUMN IF NOT EXISTS ccli_number TEXT;
   ```

4. **Run the Migration**
   - Click the **"Run"** button (or press `Ctrl+Enter` / `Cmd+Enter`)
   - Wait for success confirmation

5. **Verify the Column Was Added**
   Run this verification query:
   ```sql
   SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_name = 'songs' AND column_name = 'ccli_number';
   ```
   
   Expected result:
   ```
   column_name  | data_type | is_nullable
   -------------|-----------|-------------
   ccli_number  | text      | YES
   ```

### Option 2: Using Supabase CLI

```bash
# If you have Supabase CLI installed
supabase db push

# Or link and push manually
supabase link --project-ref your-project-ref
supabase migration up
```

---

## After Migration

1. **Clear Schema Cache** (if needed)
   - The error mentions "schema cache" - Supabase may cache schema
   - Wait 1-2 minutes for cache to refresh
   - Or restart your Supabase project (Settings → Restart)

2. **Test in Production**
   - Go to: https://www.parleap.com/songs
   - Click "New Song"
   - Leave CCLI # field empty
   - Fill in Title and Lyrics
   - Click "Create Song"
   - ✅ Should save without errors

---

## Verification Checklist

- [ ] Migration SQL executed successfully
- [ ] Column `ccli_number` exists in `songs` table
- [ ] Column is nullable (allows NULL values)
- [ ] Can create song with empty CCLI field
- [ ] Can create song with CCLI number
- [ ] No "schema cache" errors in browser console

---

## Troubleshooting

### Issue: "column already exists"
**Solution**: The migration uses `IF NOT EXISTS`, so this is safe to ignore. The column is already there.

### Issue: "permission denied"
**Solution**: Make sure you're logged in as the project owner/admin in Supabase dashboard.

### Issue: Error persists after migration
**Solution**: 
1. Wait 2-3 minutes for schema cache to refresh
2. Hard refresh browser (Ctrl+Shift+R / Cmd+Shift+R)
3. Clear browser cache
4. Check Supabase logs for any errors

---

**Once this migration is applied, the CCLI error will be resolved!**
