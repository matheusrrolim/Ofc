# OFC — Online Football Club Manager

A complete backend + mobile app for an online football club management game.
Build a club from scratch, manage a fully procedural roster, simulate matches,
trade players, and progress through divisions.

> **Status:** functional prototype. Go backend, in-memory store, Flutter
> mobile app for Android & iOS, plus a mobile-first PWA frontend served by
> the same backend. The persistence layer is designed to be swapped to
> MongoDB or Firestore by implementing a single interface.

## Stack

- **Backend:** Go 1.24 (`net/http` with method-based routing, `crypto/pbkdf2`)
- **Storage:** In-memory implementation behind `store.Store` (interface ready
  for MongoDB / Firestore drivers)
- **Mobile app (`/mobile`):** Flutter — single Dart codebase that targets
  both Android (APK / AAB) and iOS (IPA / TestFlight)
- **Web prototype (`/web`):** Mobile-first PWA — vanilla HTML / CSS / JS,
  no build step, installable on a phone home screen
- **Auth:** PBKDF2-SHA256 password hashing + opaque bearer tokens

No third-party Go dependencies.

## Run it

```bash
go run ./cmd/server
# or
go build -o ofc ./cmd/server && ./ofc
```

Server listens on `:8080` by default (override with `OFC_ADDR`). The mobile
frontend is served from `/`. Open it on a phone for the intended experience,
or in a desktop browser using a narrow window.

## Tests

```bash
go test ./...
```

Covers chemistry rules, generator ranges, economy guards, marketplace flows,
match-simulation envelope, and league/promotion logic.

## Architecture

```
cmd/server/        program entry point, HTTP server lifecycle
internal/
  models/          shared data types
  store/           Store interface + in-memory implementation
  generator/       procedural names, players, coaches, starter squads
  chemistry/       nationality synergy bonus calculator
  simulator/       match simulation engine
  economy/         currency rules, rewards, tax, sinks
  packs/           pack catalog + opening service
  marketplace/     listing creation, buy/cancel, anti-abuse rules
  league/          standings + promotion/relegation
  missions/        daily/weekly mission templates and tracking
  auth/            PBKDF2 password hashing, bearer-token sessions
  api/             HTTP handlers (one file per domain) + middleware
web/               mobile-first frontend prototype
```

Each subsystem is a small package with a clear responsibility. Adding
MongoDB later is one new `store/mongo.go` file that satisfies the same
interface — no changes to the rest of the codebase.

## API

All endpoints are JSON. Authenticated routes expect `Authorization: Bearer <token>`.

### Auth
- `POST /api/v1/auth/register` — `{username,email,password,clubName?}` → user, club, starter squad, token
- `POST /api/v1/auth/login` — `{email,password}` → token
- `POST /api/v1/auth/logout`

### Player / club
- `GET /api/v1/me`
- `GET /api/v1/clubs/{id}`
- `PATCH /api/v1/clubs/{id}` — update name, logo, stadium level
- `GET /api/v1/clubs/{id}/squad` — players + coach + chemistry breakdown
- `PUT /api/v1/clubs/{id}/coach` — `{coachId}` activate a coach you own
- `GET /api/v1/clubs/{id}/coaches`
- `GET /api/v1/players/{id}`

### Packs
- `GET /api/v1/packs`
- `POST /api/v1/packs/open` — `{packId, currency: "soft"|"premium"}`

### Marketplace
- `GET /api/v1/market`
- `POST /api/v1/market` — `{playerId, price}` (squad must keep ≥11 players)
- `DELETE /api/v1/market/{id}`
- `POST /api/v1/market/{id}/buy`

### Matches
- `POST /api/v1/matches/quick` — vs random AI, no standings impact
- `POST /api/v1/matches/league` — vs random AI, updates W/D/L and points
- `GET /api/v1/matches/{id}`
- `GET /api/v1/clubs/{id}/matches?limit=N`

### League / missions
- `GET /api/v1/league` — standings sorted by points / GD / GF
- `GET /api/v1/missions`
- `POST /api/v1/missions/{id}/claim`

## Game systems

### Player generation
Procedural only. No real-world names. Names are composed from internal first
and last name pools; nationalities come from a global pool spanning all
continents. Attributes are sampled from a rarity-driven band:

| Rarity | Range |
|---|---|
| common | 50–65 |
| rare | 60–75 |
| epic | 70–85 |
| legendary | 80–95 |
| special | 85–99 |

Position-specific bias is applied to make roles feel distinct (e.g. ATT
gets +6 finishing). Overall rating is the weighted average using
position-specific weights.

### Chemistry
Nationality synergy ladder applied to the on-pitch 11:

| Largest nationality block | Bonus |
|---|---|
| 2 players | +1% |
| 4 players | +3% |
| 6 players | +5% |
| 8+ players | +7% |

Coach matching the majority adds +3% (or +5% when the block ≥ 6). Coach
rarity contributes a `chemistryBoost` stat on top. **Total bonus is capped
at +10%.**

### Match simulation
Steps:
1. Per side: sum position-weighted ratings into attack & defense scores;
   apply chemistry, tactical and stamina multipliers; +5% home advantage.
2. Generate chances: `chances = 4 + ratio*5 + jitter`, capped at 14.
3. Convert each chance via `goalChance = attack / (defense + randomFactor)`
   (clamped to [0.04, 0.45]). Three-way outcome roll: goal / saved on target
   / off target.
4. Output: scoreline, shots, on-target, possession, chance count, and a
   minute-sorted event timeline. Goals are capped at 5 per side to keep
   results in the realistic 0-0 to 4-3 envelope.

### Economy
Two currencies. **Soft** is earned in-game; **premium** is purchased.

| Source | Soft |
|---|---|
| Starter grant | 5,000 |
| Match win | +500 |
| Match draw | +200 |
| Match loss | +100 |
| Daily mission | +300 |
| Weekly mission | +1,500 |

Sinks: pack purchases, market tax (7% by default — adjustable in basis
points), maintenance hooks (extension point in `economy.go`).

### Packs
| Pack | Cost | Players | Coach chance |
|---|---|---|---|
| Basic | 1,000 soft | 3 | 5% |
| Premium | 5,000 soft / 50 premium | 4 | 15% |
| Elite | 200 premium | 5 | 25% |

Pack tier biases the rarity table — premium packs guarantee at least rare,
elite at least epic.

### Marketplace
- Free-form pricing in soft currency (bounds: 100 – 50,000,000)
- Sellers must keep ≥11 active players
- 7% platform tax (configurable, 5–10% allowed by spec)
- Cannot buy your own listing
- Cannot list a player who is already on the market

### League
Four divisions: Bronze → Silver → Gold → Elite. Promotion at 30 points,
relegation below 10. Standings sort by points → goal difference → goals for.
`league.SeasonReset` zeroes tallies for season turnover.

### Missions
Daily and weekly templates, auto-seeded per user, refreshed at midnight UTC
or after 7 days. Tracked from match wins, goals scored, packs opened, and
players sold. Rewards are claimed on demand.

### Anti-cheat & security
- Bearer-token sessions (14d expiry); passwords hashed with PBKDF2-SHA256
  (60k iterations) and a per-user salt
- Server-side validation of every transfer (price bands, ownership,
  squad-size guard, self-buy guard)
- Currency mutations only via the `economy` package, never inline
- Match outcomes computed server-side; clients receive results, never
  upload them

## Mobile app (Android & iOS)

Full Flutter app under [`mobile/`](mobile/) — see
[mobile/README.md](mobile/README.md) for the full setup.

Quick start:

```bash
cd mobile
flutter create --org com.matheusrrolim --project-name ofc \
  --platforms=android,ios .
flutter pub get
flutter run                                            # iOS simulator
flutter run -d emulator-5554                           # Android emulator
flutter build apk --release    # → build/app/outputs/flutter-apk/app-release.apk
flutter build ios --release    # open ios/Runner.xcworkspace in Xcode
```

Highlights:
- Bottom-nav scaffold (Home / Squad / Match / Market / Packs)
- Persistent login via `shared_preferences`
- Match simulation result screen with KPI grid + minute-by-minute events
- Pack opening reveal flow
- Marketplace with buy/cancel
- Pull-to-refresh on every list, native dark theme

## Web prototype (mobile-first)

The web app under `web/` is a tiny PWA served straight by the Go backend:
- Single-page app with bottom navigation
- Touch-friendly tile lists, safe-area padding for notched devices
- Auto-login from saved bearer token in `localStorage`
- No bundler — open with any browser at `http://localhost:8080`

## Roadmap (not implemented yet)

- Persistent storage adapter (MongoDB driver)
- Tournaments (knockout brackets)
- Live multiplayer match flow
- Cosmetic store (kits, logos) in the mobile app
- Anti-cheat: per-action rate limiting, audit log
- Push notifications via FCM / APNs

## License

Prototype code; choose your license before public release.
