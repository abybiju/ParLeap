# Google Cloud Speech-to-Text Setup Guide

**Status:** Ready for when you need real STT  
**Current Mode:** Mock transcription (no cost, works offline)

---

## 🎯 When to Set This Up

**Use Mock Mode (Current) if:**
- ✅ Testing the system architecture
- ✅ Development without audio requirements
- ✅ Don't want to spend money yet

**Set Up Google Cloud if:**
- 🎤 Need real speech recognition
- 🎯 Testing with actual audio input
- 🚀 Preparing for production deployment

---

## 📋 Step-by-Step Setup

### Step 1: Create Google Cloud Project (5 mins)

1. Go to: https://console.cloud.google.com/
2. Click **"Select a project"** → **"New Project"**
3. **Name:** `parleap-ai` (or your choice)
4. Click **"Create"**
5. Wait for project creation (~30 seconds)

### Step 2: Enable Speech-to-Text API (2 mins)

1. In GCP Console, go to: **APIs & Services** → **Library**
2. Search: **"Cloud Speech-to-Text API"**
3. Click on the result
4. Click **"Enable"**
5. Wait for API to enable (~15 seconds)

### Step 3: Enable Billing (Required for API usage)

1. Go to: **Billing** in left sidebar
2. Click **"Link a billing account"**
3. Create new billing account or link existing one
4. Enter payment method

**💰 Cost**: ~$0.024 per 15 seconds (about $5-6 per hour)

### Step 4: Create Service Account (3 mins)

1. Navigate to: **IAM & Admin** → **Service Accounts**
2. Click **"Create Service Account"**
3. **Name:** `parleap-stt-service`
4. **Description:** "Service account for ParLeap Speech-to-Text"
5. Click **"Create and Continue"**

#### Grant Permissions:
6. Click **"Select a role"**
7. Search for: **"Cloud Speech Client"**
8. Select it
9. Click **"Continue"** → **"Done"**

### Step 5: Generate API Key (2 mins)

1. Click on the service account you just created
2. Go to **"Keys"** tab
3. Click **"Add Key"** → **"Create new key"**
4. Choose **"JSON"** format
5. Click **"Create"**
6. Key file will download automatically (e.g., `parleap-ai-abc123.json`)

### Step 6: Install Credentials in ParLeap (1 min)

```bash
# From your ParLeap AI directory
cd backend

# Create config directory if it doesn't exist
mkdir -p config

# Move the downloaded JSON file
mv ~/Downloads/parleap-ai-abc123.json config/google-cloud-credentials.json

# Secure the file (recommended)
chmod 600 config/google-cloud-credentials.json
```

### Step 7: Update Backend Environment (1 min)

Edit `backend/.env`:

```env
# Add this line (or update if it exists)
GOOGLE_APPLICATION_CREDENTIALS=./config/google-cloud-credentials.json

# Your existing variables
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Step 8: Verify Setup (2 mins)

```bash
# Restart backend server
cd backend
npm run dev
```

**Expected output:**
```
✅ Google Cloud Speech-to-Text initialized
🚀 Backend server running on port 3001
📡 WebSocket server ready for connections
```

**If you see this instead:**
```
⚠️  Google Cloud not configured - using mock transcription mode
```
Then check:
- File path in `.env` is correct
- JSON file exists at `backend/config/google-cloud-credentials.json`
- File has read permissions

---

## 🧪 Testing Real STT

Once configured:

1. Open: http://localhost:3000/test-websocket
2. Click **"Connect"**
3. Click **"START_SESSION"**
4. Click **"Request Access"** under Audio Capture
5. Allow microphone access
6. **Speak clearly** into your microphone
7. Watch "Ghost Text" display your words in real-time!

---

## 💰 Cost Management

### Pricing Breakdown
- **Standard Model**: $0.024 per 15 seconds
- **Enhanced Model**: $0.048 per 15 seconds (better accuracy)

### Example Costs
- **1-minute speech**: ~$0.096 (standard) or ~$0.192 (enhanced)
- **10-minute service**: ~$0.96 or ~$1.92
- **1-hour event**: ~$5.76 or ~$11.52

### Cost Optimization Tips
1. **Use Standard Model** for most cases (current default)
2. **Set Billing Alerts** in GCP Console
3. **Test with Mock Mode** during development
4. **Stop Audio Capture** when not actively speaking
5. **Use Silence Detection** (future feature)

---

## 🔒 Security Best Practices

### ✅ DO:
- Keep JSON credentials file in `backend/config/`
- Add `backend/config/*.json` to `.gitignore`
- Use service accounts (not user accounts)
- Set minimal required permissions
- Rotate keys every 90 days

### ❌ DON'T:
- Commit credentials to Git
- Share credentials publicly
- Use personal Google account keys
- Grant admin/owner permissions
- Hard-code credentials in source

---

## 🚨 Troubleshooting

### Error: "Could not load the default credentials"

**Problem**: Backend can't find credentials file

**Solutions**:
1. Check file exists: `ls backend/config/google-cloud-credentials.json`
2. Check `.env` path: `GOOGLE_APPLICATION_CREDENTIALS=./config/google-cloud-credentials.json`
3. Restart backend server
4. Try absolute path: `GOOGLE_APPLICATION_CREDENTIALS=/full/path/to/backend/config/google-cloud-credentials.json`

### Error: "Permission denied"

**Problem**: Service account lacks permissions

**Solutions**:
1. Go to IAM & Admin → Service Accounts
2. Click on your service account
3. Go to **Permissions** tab
4. Ensure **"Cloud Speech Client"** role is assigned

### Error: "API has not been used in project"

**Problem**: Speech-to-Text API not enabled

**Solutions**:
1. Go to APIs & Services → Library
2. Search "Cloud Speech-to-Text API"
3. Click "Enable"

### Error: "Billing account not set up"

**Problem**: No billing account linked

**Solutions**:
1. Go to Billing in GCP Console
2. Link or create billing account
3. Add payment method

---

## 📊 Monitoring Usage

### View API Usage:
1. GCP Console → **APIs & Services** → **Dashboard**
2. Find **"Cloud Speech-to-Text API"**
3. View requests, errors, latency

### Set Budget Alerts:
1. GCP Console → **Billing** → **Budgets & alerts**
2. Click **"Create Budget"**
3. Set monthly limit (e.g., $50)
4. Configure email alerts at 50%, 90%, 100%

---

## 🔄 Switching Between Mock and Real STT

### Use Mock (Development):
1. Remove or comment out `GOOGLE_APPLICATION_CREDENTIALS` in `.env`
2. Restart backend
3. See: "⚠️ Google Cloud not configured - using mock transcription mode"

### Use Real STT (Production):
1. Ensure `GOOGLE_APPLICATION_CREDENTIALS` is set in `.env`
2. Restart backend
3. See: "✅ Google Cloud Speech-to-Text initialized"

**No code changes needed!** The system automatically switches.

---

## 📚 Additional Resources

- [Official Google Cloud Speech-to-Text Docs](https://cloud.google.com/speech-to-text/docs)
- [Pricing Calculator](https://cloud.google.com/products/calculator)
- [Best Practices Guide](https://cloud.google.com/speech-to-text/docs/best-practices)
- [Audio Encoding Tips](https://cloud.google.com/speech-to-text/docs/encoding)

---

## ✅ Quick Checklist

Before going live with real STT:

- [ ] GCP Project created
- [ ] Speech-to-Text API enabled
- [ ] Billing account set up
- [ ] Service account created with "Cloud Speech Client" role
- [ ] JSON credentials downloaded
- [ ] Credentials file in `backend/config/`
- [ ] `.env` updated with `GOOGLE_APPLICATION_CREDENTIALS`
- [ ] `.gitignore` includes `backend/config/*.json`
- [ ] Backend restarts successfully with "✅ Google Cloud Speech-to-Text initialized"
- [ ] Test with real microphone input shows transcriptions
- [ ] Budget alerts configured in GCP Console

---

**Need Help?** Refer to `PHASE_2_4_GUIDE.md` for implementation details.

