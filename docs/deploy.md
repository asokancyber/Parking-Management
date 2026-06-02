# Deploy ParkSphere

Two paths depending on what stage you're at with the client.

| Path | Effort | Backend? | Use when |
|---|---|---|---|
| **A — Vercel demo (frontend only, mock data)** | 10 min | No, fully mocked | Client first-look / approval round. Polished, fully clickable. |
| **B — Full production (Vercel + Render + Twilio)** | ~75 min | Real Postgres + Render API + Twilio WhatsApp | After approval, when wiring real RFID + customers. |

---

## Path A — Vercel demo (recommended for client preview)

**What the client sees**: every page renders with realistic sample data, live tap feed simulates events every ~10 seconds, login accepts any credentials, all CRUD actions return success. A subtle amber banner at the top explains "Preview build — full system available on approval."

**What's NOT real**: nothing persists across reloads (no backend), WhatsApp doesn't send, no real auth.

### One-time setup

1. Push the latest code to GitHub:
   ```powershell
   git add -A
   git commit -m "Add Vercel demo mode + deploy configs"
   git push
   ```

2. Open <https://vercel.com/new> → sign in with GitHub → **Import** your repo.

3. Vercel will ask for **Root Directory** — set it to `apps/web`.

4. Framework Preset is auto-detected as Next.js. **Don't touch the Build/Install Commands** — `vercel.json` already configures them and sets `NEXT_PUBLIC_DEMO_MODE=true` automatically.

5. Click **Deploy**. Build takes ~3 min.

6. When live, you get a URL like `https://parksphere-xyz.vercel.app`.

### Test it

1. Open the URL → landing page renders with amber preview banner at top ✓
2. Click **Sign in** → enter `admin@parksphere.local / parksphere-admin` (or anything — mocked) → dashboard loads with sample stats ✓
3. **Drivers** page → 4 sample drivers shown ✓
4. **Cards** page → 6 sample cards ✓
5. **Dashboard live feed** → wait 5 seconds → simulated tap appears, then a new one every 9-10 seconds ✓
6. **Gate monitor** at `/gate/GATE-A-ENTRY/monitor` → same simulated tap stream ✓

### Send to client

```
ParkSphere demo preview

  Sign in:        https://parksphere-xyz.vercel.app/admin/login
  Demo login:     admin@parksphere.local / parksphere-admin
  Driver portal:  https://parksphere-xyz.vercel.app/driver/login
                  plate WXY1234 (or any)
  Gate monitor:   https://parksphere-xyz.vercel.app/gate/GATE-A-ENTRY/monitor

  Note: this is a preview build with simulated data. Real backend
  with RFID + WhatsApp + Postgres deploys after your approval.
```

---

## Path B — Full production deploy

When the client approves and you need the real backend, this is the path.

**Two services, two platforms:**
- **Vercel** (frontend) — what's already deployed, but flip `NEXT_PUBLIC_DEMO_MODE` off
- **Render** (backend + Postgres) — uses `render.yaml` blueprint

### Step 1 — Switch Vercel out of demo mode

1. Vercel dashboard → your project → **Settings** → **Environment Variables**.
2. **Override** `NEXT_PUBLIC_DEMO_MODE` → set to `false` (or delete the var).
3. Add `NEXT_PUBLIC_API_BASE_URL` → e.g. `https://parksphere-api.onrender.com` (you'll get this in Step 2).
4. Add `NEXT_PUBLIC_WS_URL` → e.g. `wss://parksphere-api.onrender.com`.
5. Redeploy. Demo banner disappears. Real backend calls are now active.

### Step 2 — Deploy the API + Postgres on Render

1. Go to <https://dashboard.render.com> → **New +** → **Blueprint**.
2. Connect the same repo. Render reads `render.yaml` and provisions:
   - `parksphere-api` (Node web service)
   - `parksphere-db` (Postgres)
3. Wait ~8 min for first build. Note the API URL.

### Step 3 — Wire CORS + portal URL on Render

Render dashboard → api service → **Environment**:
```
API_CORS_ORIGIN     = https://parksphere-xyz.vercel.app
DRIVER_PORTAL_URL   = https://parksphere-xyz.vercel.app/driver/login
```
Save → auto-redeploys.

### Step 4 — Seed the demo data

Render dashboard → api service → **Shell**:
```bash
npm run db:seed --workspace=apps/api
```

### Step 5 — Turn on real WhatsApp (Twilio)

1. Sign up at <https://www.twilio.com>.
2. Console → **Messaging** → **Try WhatsApp** → copy Account SID, Auth Token, sandbox From number.
3. Each driver sends `join curious-mountain` (the actual join code from Twilio) from their WhatsApp to the sandbox number — one-time.
4. Render dashboard → api → add:
   ```
   TWILIO_ACCOUNT_SID    = AC...
   TWILIO_AUTH_TOKEN     = ...
   TWILIO_WHATSAPP_FROM  = +14155238886
   ```
5. Save. `/admin/reminders` banner flips from amber DRY-RUN to green LIVE.

---

## Cost

- **Path A**: $0 forever. Vercel free tier is plenty.
- **Path B**: $0 to start (Render free, Twilio sandbox free). ~$15/mo at production scale.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Vercel build fails on monorepo | Confirm Root Directory is `apps/web`, not the repo root |
| Demo banner doesn't appear | `NEXT_PUBLIC_DEMO_MODE` env var is missing — check Vercel project settings |
| No simulated taps on dashboard | Wait 5 seconds for first tap; check browser console for errors |
| Demo data resets every reload | Expected — demo mode is stateless. Path B has real persistence. |
| Real API CORS errors after Path B | `API_CORS_ORIGIN` must match Vercel URL exactly, no trailing slash |
