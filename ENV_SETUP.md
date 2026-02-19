# Environment Variables Setup

## Frontend Environment Variables

Create `/frontend/.env.local` with the following:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# WebSocket Server (Development)
NEXT_PUBLIC_WS_URL=ws://localhost:3001

# WebSocket Server (Production)
# NEXT_PUBLIC_WS_URL=wss://your-backend.railway.app

# Google Drive Picker (Media & Announcement tabs – choose files from Drive)
# Create OAuth 2.0 Client ID (Web) in Google Cloud, enable Picker API + Drive API.
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
# Optional: Google Cloud project number (improves Picker behavior)
# NEXT_PUBLIC_GOOGLE_APP_ID=123456789012

# Unsplash (event projector background – search and set background image)
# Get your Access Key at https://unsplash.com/oauth/applications
# Used only in API route /api/unsplash/search (key is server-side, not exposed to client).
UNSPLASH_ACCESS_KEY=your_unsplash_access_key_here
```

**Vercel (production):** Add `UNSPLASH_ACCESS_KEY` in the **project** that deploys the frontend (Project → Settings → Environment Variables), not only in Team settings. Then trigger a **Redeploy** so the new variable is available to the API route.

**Projector showing the background:** The event background image is sent to the projector by the **backend** (WebSocket) in `SESSION_STARTED`. Redeploy the backend (e.g. Railway) so it runs the code that loads `events.background_image_url` and includes it in the session payload; otherwise the projector will not receive the background URL.

## Backend Environment Variables

Create `/backend/.env` with the following:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
# Optional: fall back to mock data if Supabase is unhealthy
SUPABASE_FALLBACK_TO_MOCK=false

# Matcher Tuning (Optional)
MATCHER_SIMILARITY_THRESHOLD=0.7
MATCHER_MIN_BUFFER_LENGTH=3
MATCHER_BUFFER_WINDOW=100
MATCHER_ALLOW_PARTIAL=true

# ElevenLabs Configuration
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here

# CORS Configuration (Development)
CORS_ORIGIN=http://localhost:3000

# CORS Configuration (Production)
# CORS_ORIGIN=https://your-frontend.vercel.app

# Bible Follow — Semantic matching (optional)
# When enabled, verse advance uses embedding similarity so paraphrased speech still matches.
# Set to true and provide an OpenAI API key to enable. If unset or API fails, lexical matching is used.
# BIBLE_SEMANTIC_FOLLOW_ENABLED=false
# OPENAI_API_KEY=your_openai_api_key_here
# BIBLE_EMBEDDING_API_KEY=alternative_key_override
# BIBLE_EMBEDDING_MODEL=text-embedding-3-small

# Smart Paste / Auto-Format (Song editor — paste messy lyrics, click Auto-Format)
# Uses gpt-4o-mini to extract title, artist, and structured sections. Same key as above.
# If OPENAI_API_KEY is set (e.g. for Bible Follow), Auto-Format works; if unset, the button returns a friendly error.
# OPENAI_API_KEY=your_openai_api_key_here
```

## How to Get Your Keys

### Supabase Keys

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **API**
3. Copy:
   - **Project URL**: Use for `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public**: Use for `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role**: Use for `SUPABASE_SERVICE_ROLE_KEY` (backend only, keep secret!)

### ElevenLabs API Key

1. Go to [elevenlabs.io](https://elevenlabs.io)
2. Sign up or log in
3. Navigate to your profile settings
4. Generate an API key
5. Copy to `ELEVENLABS_API_KEY`

### Google Drive Client ID (optional – for Media & Announcement “Choose from Google Drive”)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project or select an existing one
3. Enable **Google Picker API** and **Google Drive API** (APIs & Services → Library)
4. Go to **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**
5. Application type: **Web application**
6. Add **Authorized JavaScript origins** (e.g. `https://www.parleap.com`, `http://localhost:3000`)
7. Copy the **Client ID** to `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
8. Optional: copy your **Project number** (from Dashboard) to `NEXT_PUBLIC_GOOGLE_APP_ID`

## Security Notes

- **NEVER commit** `.env` or `.env.local` files to git
- The `service_role` key bypasses Row Level Security - only use in backend
- The `anon` key is safe to expose in frontend (protected by RLS)
- In production, use environment variables from your hosting platform
