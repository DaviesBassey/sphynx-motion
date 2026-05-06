# SphynxPlay — Production Setup Guide

## Prerequisites
- [Supabase](https://supabase.com) account (free)
- [Mux](https://mux.com) account (free trial, then pay-per-use)
- Node.js 18+ installed locally
- For mobile: Xcode (iOS) or Android Studio

---

## Step 1 — Create your Supabase project

1. Go to https://supabase.com → **New project**
2. Name: `sphynxplay`, region: **Europe West (Frankfurt)**
3. Wait ~2 minutes for spin-up
4. **Project Settings → API** — copy these three values into `server/.env`:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

## Step 2 — Run database migrations

In **Supabase Dashboard → SQL Editor**, run these files in order:

```
supabase/migrations/001_schema.sql   — tables + triggers
supabase/migrations/002_rls.sql      — row-level security + token RPCs
supabase/migrations/003_i18n.sql     — languages + translations
supabase/migrations/004_video.sql    — Mux columns + view counters
```

## Step 3 — Create your superadmin account

1. Supabase Dashboard → **Authentication → Users → Invite user**
2. Enter `daviesbasseya@gmail.com`, accept the invite, set a password
3. In SQL Editor:

```sql
UPDATE public.profiles
SET role = 'superadmin'
WHERE email = 'daviesbasseya@gmail.com';
```

## Step 4 — Create Supabase Storage buckets

**Storage → New bucket** (create all three):

| Bucket | Public? |
|--------|---------|
| `posters`  | ✅ Yes (poster images) |
| `trailers` | ✅ Yes (trailer clips)  |
| `videos`   | ❌ No  (private — for direct Supabase Storage videos) |

> **Note:** For production video hosting use Mux (Step 6). The `videos` bucket is only for fallback MP4.

## Step 5 — Configure server/.env

```env
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

PORT=3000
NODE_ENV=development
COOKIE_SECRET=<run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
PUBLIC_ORIGIN=http://localhost:3000

# Mux (add after Step 6)
MUX_TOKEN_ID=your-mux-token-id
MUX_TOKEN_SECRET=your-mux-token-secret
MUX_WEBHOOK_SECRET=your-mux-webhook-signing-secret
```

## Step 6 — Set up Mux (video hosting)

1. Go to https://dashboard.mux.com → **Settings → API Access Tokens**
2. Create a token with **Mux Video → Full Access**
3. Copy `Token ID` and `Token Secret` into `server/.env`
4. **Mux Dashboard → Webhooks → Create webhook**
   - URL: `https://YOUR_DOMAIN/api/mux/webhook`
   - Events: `video.asset.ready`, `video.asset.errored`
   - Copy the **Signing Secret** into `MUX_WEBHOOK_SECRET`

> For local testing: use `ngrok http 3000` to expose localhost, then set webhook URL to your ngrok URL.

## Step 7 — Start locally

```bash
cd server
npm install
npm start
```

| URL | What it serves |
|-----|----------------|
| `http://localhost:3000/` | Public SphynxPlay app |
| `http://localhost:3000/admin/login` | Admin login |
| `http://localhost:3000/admin/dashboard` | Admin dashboard |

---

## Deploy to Railway (Recommended)

1. Push this repo to GitHub
2. Go to https://railway.app → **New Project → Deploy from GitHub**
3. Select your repo — Railway auto-detects `railway.toml`
4. Add environment variables in Railway dashboard (same as `server/.env`)
5. Set `PUBLIC_ORIGIN` to your Railway domain (e.g. `https://sphynxplay.up.railway.app`)
6. Update `MUX_WEBHOOK_SECRET` webhook URL to your Railway domain

## Deploy to Render

1. Push to GitHub
2. Go to https://render.com → **New → Web Service**
3. Connect repo — Render detects `render.yaml`
4. Fill in environment variables in Render dashboard
5. Set `PUBLIC_ORIGIN` to your Render URL

## Deploy with Docker

```bash
docker build -t sphynxplay .
docker run -p 3000:3000 --env-file server/.env sphynxplay
```

---

## Admin content management

Once deployed and logged in as superadmin at `/admin/dashboard`:

1. **Series** → Add Series → fill title, genre, poster URL, status=`live`
2. **Episodes** → Add Episode → select series, upload video via Mux (Upload tab)
3. **Upload** → drag-and-drop poster/trailer/video
4. **Moderation** → approve/reject creator submissions
5. **Soul Tokens** → grant tokens, manage packages
6. **Languages** → manage UI translations per language

### Add series + episodes (SQL shortcut for testing)

```sql
-- Insert a test series
INSERT INTO public.series (title, slug, genre, status, is_featured, poster_url)
VALUES ('Gold Veins', 'gold-veins', 'Neo-Noir', 'live', true, 'https://your-bucket.supabase.co/storage/v1/object/public/posters/gold-veins.jpg');

-- Insert a free episode
INSERT INTO public.episodes (series_id, episode_number, title, is_free, status)
SELECT id, 1, 'The Third Name', true, 'live' FROM public.series WHERE slug = 'gold-veins';
```

---

## Mobile (Capacitor — after web app is stable)

```bash
# Install Capacitor
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android

# Initialise (run from project root)
npx cap init "SphynxPlay" com.sphynxplay.app --web-dir .

# Add platforms
npx cap add ios
npx cap add android

# Sync web assets to native
npx cap sync

# Open in Xcode (iOS)
npx cap open ios

# Open in Android Studio
npx cap open android
```

`capacitor.config.json` is already configured. Before submitting to App Store / Play Store:
- Set `server` URL in config to your production domain (not localhost)
- Add App Store / Play Store assets (screenshots, icon, etc.)
- Enable Push Notifications plugin if needed

---

## Role permissions

| Role | Access |
|------|--------|
| **user** | Watch, subscribe, buy/earn Soul Tokens, vote |
| **creator** | Submit episodes/posters, view own stats |
| **admin** | Full content CRUD, moderation, user management, token grants |
| **superadmin** | Everything + revenue, payouts, financial settings, role management |

## Security notes

- `SUPABASE_SERVICE_ROLE_KEY` is **never** sent to the browser — server-side only
- `SUPABASE_ANON_KEY` is exposed via `/api/config` — this is safe (controlled by RLS)
- Admin routes are protected server-side by JWT + role check (not just client-side JS)
- All Supabase tables have Row Level Security (RLS) enabled
