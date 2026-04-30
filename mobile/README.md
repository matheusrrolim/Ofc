# OFC — Mobile App (Android + iOS)

A Flutter app that targets **Android** and **iOS** from a single Dart codebase.
It connects to the Go backend in `../` and matches its REST API.

## Features

- Login & registration with persistent token (`shared_preferences`)
- Bottom-nav scaffold: Home / Squad / Match / Market / Packs
- Procedurally-generated player and coach tiles with rarity badges
- Chemistry breakdown card
- Match simulation with animated score banner, KPIs, and event log
- Pack opening flow with reveal screen
- Player marketplace with buy / cancel flow
- Daily/weekly missions with claim button
- Pull-to-refresh on every list
- Native dark theme matching the web prototype

## Repository layout

The repo only ships the Dart source under `lib/`. Platform scaffolding for
Android and iOS is generated locally by `flutter create` (see below) — that's
the standard Flutter workflow because those directories contain user-specific
identifiers (bundle ID, signing config, build numbers).

```
mobile/
├── pubspec.yaml
├── analysis_options.yaml
├── lib/
│   ├── main.dart
│   ├── app.dart
│   ├── theme.dart
│   ├── api/
│   │   ├── client.dart           HTTP client, Bearer auth
│   │   └── models.dart           DTOs matching backend JSON
│   ├── state/
│   │   └── app_state.dart        ChangeNotifier with auth + cached user/club
│   ├── widgets/
│   │   └── tiles.dart            Reusable tiles (player, coach, KPI, …)
│   └── screens/
│       ├── splash.dart
│       ├── auth_screen.dart
│       ├── home_shell.dart       App scaffold + bottom navigation
│       ├── home_tab.dart
│       ├── squad_tab.dart
│       ├── match_tab.dart
│       ├── match_result_screen.dart
│       ├── market_tab.dart
│       ├── packs_tab.dart
│       └── pack_result_screen.dart
└── test/
    └── smoke_test.dart
```

## First-time setup

```bash
cd mobile

# 1. Generate the android/, ios/, etc. platform projects.
#    This will NOT overwrite our existing lib/ files.
flutter create --org com.matheusrrolim --project-name ofc \
  --platforms=android,ios .

# 2. Install Dart packages.
flutter pub get
```

### Allow HTTP to localhost for dev

The dev backend runs on plain HTTP. Both platforms block cleartext traffic by
default — relax it in dev only.

**Android** — add `android:usesCleartextTraffic="true"` to the
`<application>` element in `android/app/src/main/AndroidManifest.xml`:

```xml
<application
    android:label="OFC"
    android:usesCleartextTraffic="true"
    ...>
```

**iOS** — add this to `ios/Runner/Info.plist` inside the top-level `<dict>`:

```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
</dict>
```

Production builds should use HTTPS and remove these flags.

## Run the backend

In the repo root:

```bash
go run ./cmd/server          # listens on :8080
```

## Run the app

### Android — emulator

```bash
flutter run -d emulator-5554
```

The app defaults to `http://10.0.2.2:8080`, which is the Android emulator's
loopback to the host machine.

### Android — physical device

Find your computer's LAN IP (e.g. `192.168.1.42`) and start the backend
binding to all interfaces:

```bash
OFC_ADDR=:8080 go run ./cmd/server
```

Then run with the LAN URL:

```bash
flutter run --dart-define=OFC_API_BASE_URL=http://192.168.1.42:8080
```

### iOS — simulator

```bash
flutter run -d "iPhone 15"
# uses http://localhost:8080 automatically
```

### iOS — physical device

```bash
cd ios && pod install && cd ..
flutter run --dart-define=OFC_API_BASE_URL=http://192.168.1.42:8080 \
            -d "<your iPhone>"
```

iOS requires opening `ios/Runner.xcworkspace` once in Xcode to set the team
for code signing.

## Build release artifacts

### Android APK

```bash
flutter build apk --release \
  --dart-define=OFC_API_BASE_URL=https://api.your-domain.com
```

The APK lands in `build/app/outputs/flutter-apk/app-release.apk`. For Play
Store, use `flutter build appbundle` instead.

### iOS

```bash
flutter build ios --release \
  --dart-define=OFC_API_BASE_URL=https://api.your-domain.com
# Open ios/Runner.xcworkspace in Xcode to archive & upload to TestFlight.
```

## Tests

```bash
flutter test
```

## Configuration

| Build flag | Default | Purpose |
| --- | --- | --- |
| `--dart-define=OFC_API_BASE_URL=…` | Android emulator → `http://10.0.2.2:8080`, otherwise `http://localhost:8080` | Backend URL |

## Roadmap

- Push notifications (FCM / APNs)
- Live matches via WebSocket
- Cosmetic store (kits, logos, stadium themes)
- Localized strings (i18n)
- Onboarding tutorial
