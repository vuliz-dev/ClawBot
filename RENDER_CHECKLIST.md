# ⚡ Render Deployment - Quick Checklist

Copy & paste this checklist to track your deployment progress.

## 📋 Pre-Deploy (5 min)

- [ ] Have GitHub account ready
- [ ] Have Render account (signup at render.com)
- [ ] Get `TELEGRAM_BOT_TOKEN` from @BotFather
- [ ] Get `ANTHROPIC_API_KEY` from api.anthropic.com (or other AI provider)

## 🔧 Local Preparation (2 min)

- [ ] Commit code: `git add . && git commit -m "deploy: render setup"`
- [ ] Push to GitHub: `git push origin main`
- [ ] Verify these files exist in repo:
  - [ ] `Dockerfile`
  - [ ] `.dockerignore`
  - [ ] `render.yaml`
  - [ ] `package.json`
  - [ ] `pnpm-lock.yaml`

## 🚀 Render Setup (3 min)

### Account & Auth
- [ ] Create Render account
- [ ] Connect GitHub to Render
- [ ] Authorize repository access

### Create Web Service
- [ ] Click **New +** → **Web Service**
- [ ] Select your ClawBot repo
- [ ] Name: `clawbot`
- [ ] Runtime: **Docker**
- [ ] Click **Create Web Service**

### Add Environment Variables
- [ ] Set `TELEGRAM_BOT_TOKEN`
- [ ] Set `ANTHROPIC_API_KEY`
- [ ] Set `AI_PROVIDER=anthropic`
- [ ] Set `NODE_ENV=production`

### Add Persistent Storage
- [ ] **Disks** tab → Add Disk
  - Name: `data`
  - Path: `/app/data`
  - Size: 1 GB
- [ ] (Optional) Repeat for `/app/workspace`

## ✅ Post-Deploy (5 min)

### Verify Build
- [ ] Check **Logs** tab - no errors
- [ ] Should see: `[clawbot] ready ✓`
- [ ] Build completed successfully

### Test Bot
- [ ] Send message to your Telegram bot
- [ ] Receive response from ClawBot
- [ ] Check Render logs for no errors

### Verify Service
- [ ] Copy Render service URL
- [ ] Visit URL in browser (check it's running)
- [ ] Check `/` endpoint responds

## 🎯 Done! 🎉

Your ClawBot is now running 24/7 on cloud.

---

## 🔄 Regular Maintenance

After first deploy, use this for updates:

### To Update Code
```bash
# Make changes locally
git add .
git commit -m "fix: something"
git push origin main
```
→ Render auto-redeploys within 2-3 minutes

### To Change Settings
1. Render dashboard → Environment
2. Edit variables
3. Click **Save**
4. Render restarts service

### To Check Logs
- Render dashboard → Logs tab
- Real-time monitoring
- Search for errors

---

## ⚙️ If Something Goes Wrong

| Problem | Solution |
|---------|----------|
| Bot doesn't respond | Check `TELEGRAM_BOT_TOKEN` in Render env vars |
| Build fails | Check Render logs, test locally with `docker build .` |
| Data disappeared | Check `/app/data` disk exists in Disks tab |
| Service crashes | Check logs for error, fix code, push to GitHub |
| Slow responses | First request slow (cold start), subsequent faster |

---

## 💡 Tips

- **Cost**: Free tier is 100% free, never auto-charges
- **Uptime**: 99.9% SLA on paid plans, free tier suspends after 15 min inactivity
- **Monitoring**: Check logs daily first week to catch issues early
- **Auto-deploy**: Enabled by default, new pushes auto-redeploy
- **Rollback**: Push old code to GitHub to rollback instantly

---

**Questions?** Check [DEPLOY_RENDER.md](./DEPLOY_RENDER.md) for full guide.
