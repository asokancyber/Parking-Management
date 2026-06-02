# ParkSphere Enterprise

**Enterprise Smart Vehicle Access Control & Parking Subscription Platform.**
RFID / NFC card-based access for factories, warehouses, and logistics hubs.
Subscription-billed monthly. Every tap is validated and recorded forever.

> Foundation build, not production-ready. **Read the hardening checklist at the end before any real gate, real money, or real driver touches this.**

---

## TL;DR — one command

```powershell
.\start.bat
```

That's it. First run: installs deps, creates SQLite DB, seeds demo data, launches API + Web, auto-opens your browser. Subsequent runs: just launches.

If anything misbehaves: `.\doctor.bat` tells you exactly what's wrong.

---

## The three scripts

| Script              | Purpose                                                    |
| ------------------- | ---------------------------------------------------------- |
| `start.bat`         | The only thing you run. Self-installs, self-seeds, launches. |
| `doctor.bat`        | Read-only diagnostics. Run when something looks broken.    |
| `start-docker.bat` / `setup-docker.bat` | Optional production-shaped stack (Postgres in Docker). |

There is **no reset script** — that was the dangerous one you ran by mistake. If you ever truly need to start over, manually delete `apps/api/prisma/parksphere.db` and re-run `start.bat`.

---

## What's running where

| Layer  | URL                                       |
| ------ | ----------------------------------------- |
| Web    | http://localhost:3000                     |
| API    | http://localhost:4000/api/v1              |
| Health | http://localhost:4000/api/v1/health       |
| DB     | apps/api/prisma/parksphere.db             |

The API prints a **READY** banner on startup with green pre-flight checks. If startup is broken, you'll see **STARTED WITH ERRORS** there immediately.

---

## Demo accounts

| Role   | Email                       | Password             |
| ------ | --------------------------- | -------------------- |
| Admin  | admin@parksphere.local      | parksphere-admin     |
| Driver | raju@parksphere.local       | parksphere-driver    |
| Driver | ahmad@parksphere.local      | parksphere-driver    |
| Driver | siti@parksphere.local       | parksphere-driver    |
| Driver | expired@parksphere.local    | parksphere-driver    |

Seeded card UIDs:
- `04A21B3C` Raju · `047B92E1` Ahmad · `04C1F9D2` Siti · `04D3E882` Tan (expired sub — will deny)
- `04E55A14` (IN_STOCK) · `04F11C2B` (LOST)
- Anything else → DENIED_CARD_UNKNOWN

Gates: `GATE-A-ENTRY`, `GATE-A-EXIT`. Access tokens visible in **Admin → Gates → Show**.

---

## End-to-end demo

1. Open the gate monitor in a second window: `http://localhost:3000/gate/GATE-A-ENTRY/monitor`.
2. Log into admin: `http://localhost:3000/admin/login`.
3. **Gates → Simulate tap → pick Raju's chip → Tap**. Monitor flashes green, dashboard updates, occupancy +1.
4. Simulate with UID `04F11C2B` → red flash, "Card reported lost".
5. **Cards → Raju → Replace** with a new UID → new card inherits subscription, old retired.

---

## Troubleshooting

### "Failed to fetch" / login doesn't load
Run `doctor.bat`. If it says the API is down, scroll up in the `start.bat` terminal and look for the **READY** banner. If it's red, the pre-flight check lists what's missing.

### "404 This page could not be found"
The Next.js dev cache got into a bad state. Stop the terminal (Ctrl+C), then run `start.bat` — it auto-clears partial `.next` caches and rebuilds.

### Port already in use
Something is on 3000 or 4000. Check with `netstat -ano | findstr ":3000 :4000"` and kill the stale process.

### Schema mismatch (READY banner says "STARTED WITH ERRORS")
Stop the terminal. Delete `apps/api/prisma/parksphere.db`. Run `start.bat` again — it'll recreate from the current schema and reseed.

---

## Repo layout

```
.
├── start.bat                          THE launcher (install + seed + run)
├── doctor.bat                         diagnostics
├── start-docker.bat / setup-docker.bat   optional Postgres-in-Docker flow
├── docker-compose.yml                 Postgres (Docker mode only)
├── scripts/open-when-ready.ps1        browser auto-opener
├── apps/
│   ├── api/                           NestJS backend
│   │   ├── prisma/
│   │   │   ├── schema.postgres.prisma
│   │   │   ├── schema.sqlite.prisma
│   │   │   └── seed.ts
│   │   └── src/
│   │       ├── common/enums.ts        enum constants (works on both schemas)
│   │       ├── auth/                  JWT auth
│   │       ├── drivers/, vehicles/, subscriptions/, gates/
│   │       ├── cards/                 card lifecycle
│   │       ├── card-access/           POST /card-access/tap (the RFID endpoint)
│   │       ├── settings/, realtime/, audit/
│   │       └── health/                /health endpoint
│   └── web/
│       └── src/app/
│           ├── page.tsx                       landing
│           ├── gate/[code]/monitor/           live RFID display
│           ├── admin/login/                   with live API health banner
│           ├── admin/dashboard/               live tap feed
│           ├── admin/cards/, admin/gates/, admin/settings/
```

---

## How the card-access pipeline works

```
RFID reader (or built-in simulator)
  │ POST /api/v1/card-access/tap
  │ Authorization: Bearer <gate.accessToken>
  │ { cardUid: "04A21B3C" }
  ▼
[ Gate auth ]      reject if accessToken doesn't match any gate
  ▼
[ UID lookup ]     normalize → fetch Card by uid
  ▼
[ Card status ]    must be ACTIVE (else DENIED_CARD_LOST/INACTIVE/...)
  ▼
[ Card expiry ]    optional per-card expiresAt check
  ▼
[ Driver assn ]    card must be assigned to a driver
  ▼
[ Vehicle ]        driver must have at least one active vehicle
  ▼
[ Subscription ]   ACTIVE + not expired + not suspended/blacklisted
  ▼
[ Occupancy ]      ENTRY +1, EXIT -1 (clamped)
  ▼
[ HARDWARE ]       publish OPEN_GATE (currently logs only — see hardening list)
  ▼
[ Audit ]          CardTapEvent + AuditLog persisted
[ Realtime ]       broadcast to gate room (monitor) + admin room (dashboard)
```

---

## What's stubbed

| Area                  | Status   | Where                                       |
| --------------------- | -------- | ------------------------------------------- |
| ESP32 / relay command | Stubbed  | `[HARDWARE STUB]` in `card-access.service.ts` |
| Hardware confirmation | Missing  | We mark GRANTED before the gate physically opens |
| Payment gateway       | Not impl |                                             |
| OTP delivery          | Stubbed  |                                             |
| WhatsApp notifications | Not impl |                                            |
| Tap debounce          | Setting exists, enforcement TBD            |
| Multi-branch / tenancy | Not impl |                                           |
| Reports               | Not impl |                                             |
| ANPR / face recognition | Not impl |                                          |
| Offline reader queue  | Not impl |                                             |

---

## Hardening checklist before going live

- [ ] Rotate every secret in `apps/api/.env` and every gate's `accessToken`.
- [ ] Hash gate access tokens at rest. Surface raw token only at creation/rotation time.
- [ ] HTTPS / WSS only.
- [ ] Rate-limit `/card-access/tap` per gate token; `/auth/login` per IP.
- [ ] **Hardware handshake** — we currently mark GRANTED before the gate physically opens. Add a confirmation step from the relay.
- [ ] Idempotency on `/card-access/tap` so reader retries don't double-count.
- [ ] Wire the tap debounce setting into the validation pipeline.
- [ ] Real payment gateway with idempotent webhooks.
- [ ] Backup + DR for the database.
- [ ] Monitoring: ship logs + a heartbeat from each reader.
- [ ] Load test at peak tap rate.
- [ ] Reader firmware security — gate tokens shouldn't sit plaintext on a stolen reader.
- [ ] Pen-test `/gates/public/:code` and `/card-access/tap`.
- [ ] Card UID spoofing — layer DESFire/MIFARE Plus crypto auth on the reader side if your threat model needs it.
