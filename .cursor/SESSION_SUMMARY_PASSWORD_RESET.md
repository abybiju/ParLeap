# Session Summary - Password Reset / Forgot Password

## Overview
Implemented full forgot-password and reset-password flow so recovery emails point to production and users can reset from the login page or change password from Profile.

## Implemented

### 1. Forgot password page (`/auth/forgot-password`)
- Email form; calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: origin + '/auth/reset-password' })`
- Success state: "Check your email" and link back to sign in
- Styling matches login (glassmorphism, dark theme)

### 2. Reset password page (`/auth/reset-password`)
- User lands from email link; Supabase parses hash and establishes session
- States: loading → ready (form) or invalid/expired link
- Form: new password + confirm; Zod (min 6 chars, match); `updateUser({ password })` then redirect to `/dashboard` with toast

### 3. Login page
- "Forgot your password?" link next to Password label → `/auth/forgot-password`

### 4. Profile Security section
- "Reset Password" opens Dialog with new password + confirm; `updateUser({ password })`; toast and close

### 5. Middleware
- No change; `/auth/forgot-password` and `/auth/reset-password` already allowed (under `/auth/*`)

## Supabase configuration (manual)
- **Site URL**: e.g. `https://www.parleap.com` (so recovery emails don’t use localhost)
- **Redirect URLs**: include `https://www.parleap.com/auth/callback`, `https://www.parleap.com/auth/reset-password`; optionally non-www and Vercel URLs

## Commit
- `8c00cf3` — feat: forgot password flow and reset from profile

## Files
- `frontend/app/auth/forgot-password/page.tsx` (new)
- `frontend/app/auth/reset-password/page.tsx` (new)
- `frontend/app/auth/login/page.tsx` (forgot link)
- `frontend/components/profile/sections/SecuritySection.tsx` (reset modal + Dialog)
