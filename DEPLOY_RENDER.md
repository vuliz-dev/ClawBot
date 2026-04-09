# 🚀 ClawBot - Render Deployment Guide

Deploy ClawBot to Render in 5 minutes. Runs 24/7 on cloud, no local machine needed.

## ✅ Prerequisites

- GitHub account with this repo
- Render account (free tier)
- Telegram Bot Token (from @BotFather)
- Anthropic API Key (or other AI provider)

---

## 🎯 Step 1: Setup Render Account

1. Go to [render.com](https://render.com)
2. Sign up with GitHub (easier for auto-deploy)
3. Complete account setup

---

## 📦 Step 2: Push Code to GitHub

```bash
# If not already on GitHub, do this first:
git add .
git commit -m "feat: prepare for Render deployment"
git push origin main
```

Make sure these files are committed:
- `Dockerfile`
- `.dockerignore`
- `render.yaml`
- `package.json`
- `pnpm-lock.yaml`

---

## 🔧 Step 3: Create Web Service on Render

### Option A: Auto-deploy from GitHub (Recommended)

1. In Render dashboard: **New +** → **Web Service**
2. Select **Deploy an existing repository**
3. Find your ClawBot repo, click **Connect**
4. Fill in:
   - **Name**: `clawbot`
   - **Runtime**: Docker
   - **Build Command**: (leave empty - uses Dockerfile)
   - **Start Command**: (leave empty - uses Dockerfile)
5. Click **Create Web Service**

### Option B: Manual (via render.yaml)

Render can auto-detect `render.yaml`:

```bash
# If you have Render CLI installed:
render deploy --project-id=<your-project>
```

---

## 🔑 Step 4: Set Environment Variables

In Render dashboard for your service:

1. Go to **Environment** tab
2. Add these variables:

| Variable | Value | Source |
|----------|-------|--------|
| `TELEGRAM_BOT_TOKEN` | Your bot token | @BotFather on Telegram |
| `ANTHROPIC_API_KEY` | Your API key | api.anthropic.com |
| `AI_PROVIDER` | `anthropic` | (default) |
| `NODE_ENV` | `production` | (fixed) |
| `GATEWAY_PORT` | `3000` | (fixed) |
| `DB_PATH` | `./data/clawbot.db` | (uses Render volume) |
| `WORKSPACE_DIR` | `./workspace` | (uses Render volume) |

**Optional variables** (customize if needed):
```
MAX_CONTEXT_TOKENS=80000
BASH_APPROVAL_MODE=smart
ALLOWED_USER_IDS=your_user_id  # Comma-separated Telegram IDs
```

---

## 💾 Step 5: Add Persistent Volume (for data)

Your ClawBot saves session data to `./data/clawbot.db`. On Render, this needs persistent storage.

1. In service **Disks** tab
2. Click **Add Disk**
   - **Disk Name**: `data`
   - **Mount Path**: `/app/data`
   - **Size**: 1 GB (free)
3. Click **Add Disk**
4. Repeat for `/app/workspace` if you need file storage

---

## 🚀 Step 6: Deploy

### First Deploy

```bash
git add .
git commit -m "feat: render deployment config"
git push origin main
```

Render will automatically:
1. Detect new push
2. Build Docker image
3. Start service
4. Deploy to cloud

**Check logs**: Go to **Logs** tab in Render dashboard

### Redeploy Later

Just push to GitHub:
```bash
git push origin main
```

Or manually in Render: **Manual Deploy** button

---

## ✨ Step 7: Verify It Works

1. Check Render logs - should see:
   ```
   [clawbot] starting...
   [clawbot] ai provider: anthropic
   [clawbot] ready ✓
   ```

2. Test Telegram bot:
   - Message your bot
   - Should get response (might be slow first time)

3. Check Render URL:
   - Go to service settings
   - Copy service URL (like `https://clawbot-xxx.onrender.com`)
   - Visit in browser (should not error)

---

## 🐛 Troubleshooting

### Bot doesn't respond
- Check `TELEGRAM_BOT_TOKEN` is correct
- Check Render logs for errors
- Make sure bot still exists (@BotFather → /mybots)

### Build fails
```bash
# Test build locally first:
docker build -t clawbot .
docker run -e TELEGRAM_BOT_TOKEN=test clawbot
```

### Out of memory
- Render free tier: 512MB RAM
- If hitting limits, upgrade plan or reduce `MAX_CONTEXT_TOKENS`

### Data lost after restart
- Ensure `/app/data` and `/app/workspace` disks are mounted
- Check **Disks** tab in Render

### Slow responses
- First request takes ~10s (cold start)
- Subsequent requests faster
- Upgrade plan if consistent slowness

---

## 📊 Monitoring

### Check if service is alive
```bash
curl https://clawbot-xxx.onrender.com/
```

Should return HTTP 200 or 404 (either is fine, means server running).

### View logs
- Render dashboard → Service → **Logs** tab
- Real-time streaming of all output

---

## 💰 Pricing

| Item | Free Tier | Cost |
|------|-----------|------|
| Web Service | Yes (512MB) | $0 |
| Disk Storage | Yes (1GB) | $0 |
| Build hours | Yes (500h/month) | $0 |
| **Total** | | **$0** |

**Upgrade to paid** ($7/month) when you need:
- More RAM (>512MB)
- Always-on (free tier spins down after 15 min inactivity)
- More storage (>1GB)

---

## 🔄 CI/CD Pipeline

Once deployed, your Render service will:

1. Watch GitHub for changes
2. Automatically rebuild when you push
3. Deploy new version within 2-3 minutes
4. Keep running 24/7

No more pushing from local machine needed!

---

## 📝 Next Steps

1. **Custom domain** (optional):
   - In Render → Custom Domain
   - Point your domain DNS to Render

2. **Auto-scaling** (paid):
   - Render → Scaling settings
   - Scale instances based on load

3. **Database upgrade**:
   - Currently using local JSON file
   - Consider PostgreSQL for production (Render has free 30-day trial)

---

## 🆘 Need Help?

- **Render docs**: https://render.com/docs
- **ClawBot logs**: Check Render dashboard
- **Telegram issues**: Check bot token with @BotFather

Enjoy! 🎉
