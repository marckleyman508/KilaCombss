# KilaCombs — Deployment Guide

## Folder Structure
```
kilacombs-deploy/
├── server.js              ← Node.js backend (no Python needed)
├── package.json
├── railway.toml           ← Railway config
├── render.yaml            ← Render config
├── Procfile               ← Heroku/Railway
├── .gitignore
├── public/
│   └── shop.html          ← Full website (auto-served at /)
└── data/                  ← Auto-created on first run
    ├── kilacombs-db.json  ← JSON database
    └── kilacombs_datasheet.xlsx  ← Live Excel (created on first order)
```

---

## Option A — Railway (Recommended, Free tier available)

1. Create account at https://railway.app
2. Install Railway CLI:
   ```
   npm install -g @railway/cli
   ```
3. In this folder, run:
   ```
   railway login
   railway init
   railway up
   ```
4. Railway gives you a URL like `https://kilacombs-production.up.railway.app`
5. Your site is live at that URL — orders write to Excel automatically

**OR via GitHub (no CLI needed):**
1. Push this folder to a GitHub repo
2. Go to railway.app → New Project → Deploy from GitHub
3. Select your repo → Railway auto-detects Node → deploys
4. Done

---

## Option B — Render (Also free tier)

1. Push this folder to GitHub
2. Go to https://render.com → New → Web Service
3. Connect your GitHub repo
4. Settings:
   - Build Command: `npm install`
   - Start Command: `node server.js`
5. Click Deploy → get your live URL

---

## Option C — Local (your own machine)

```bash
cd kilacombs-deploy
npm install
node server.js
```
Open: http://localhost:3000

---

## How Orders Flow to Excel

1. Customer submits order on website
2. `server.js` saves to `data/kilacombs-db.json` (instant)
3. `server.js` writes a new row to `data/kilacombs_datasheet.xlsx` using the `xlsx` npm package
4. Download the live Excel anytime at: `https://YOUR-URL/api/excel/download`

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | / | Shop website |
| GET | /api/health | Server status |
| POST | /api/orders/full | Full cart checkout → Excel |
| POST | /api/orders | Wholesale-only (legacy) |
| POST | /api/signups | Email signup |
| GET | /api/excel/stats | Live stats |
| GET | /api/excel/download | Download Excel file |
| GET | /api/admin/stats | Admin dashboard data |
| PATCH | /api/orders/:id/status | Update order status |
