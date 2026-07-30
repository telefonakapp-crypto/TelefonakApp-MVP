# iOS Development Workflow

This document is the source of truth for running and developing the Telefonak **mobile** app on iOS after Sprint 1.

Telefonak uses an Expo project with a **generated native iOS project** (`mobile/ios/`). Daily work targets the native **Telefonak** Debug build on the iOS Simulator (or a device), not Expo Go.

Do not treat this as application logic documentation. It only describes how to run and rebuild the native development environment.

---

## 1. Daily development workflow

### Prerequisites (once per machine)

- Node.js and npm installed
- Xcode installed (with iOS Simulator runtimes)
- CocoaPods available (`pod` via the Expo / React Native tooling)
- Backend database configured (see `SETUP.md`)

### Every day (typical loop)

1. **Start the backend** (API on port 3000):

   ```bash
   cd backend
   npm run dev
   ```

   Set `BASE_URL` in `backend/.env` to the public origin used for `/uploads/...` image URLs
   (local default: `http://localhost:3000`).

2. **Configure the mobile API URL** (once per environment; restart Metro after changes):

   ```bash
   cd mobile
   cp .env.example .env
   ```

   | Target | `EXPO_PUBLIC_API_URL` |
   |--------|------------------------|
   | iOS Simulator | `http://localhost:3000` |
   | Android Emulator | `http://10.0.2.2:3000` |
   | Physical device | `http://YOUR_LAN_IP:3000` |
   | Production | `https://api.telefonak.com` |

3. **Start Metro** (JS bundler on port 8081):

   ```bash
   cd mobile
   npm start
   ```

   Leave this terminal running while you develop.

4. **Run the native app** (first launch of the day, or after a rebuild):

   ```bash
   cd mobile
   npx expo run:ios --device "iPhone 17 Pro"
   ```

   If Metro is already running, reuse it:

   ```bash
   npx expo run:ios --device "iPhone 17 Pro" --no-bundler
   ```

5. **Edit JavaScript / React Native code** under `mobile/src/` (and related JS). Metro hot-reloads; a full native rebuild is usually **not** required.

6. **Stop for the day** by quitting the simulator if you want, and stopping Metro / the backend terminals with `Ctrl+C`.

### Correct app to open

- Use the purple **Telefonak** app on the simulator.
- Do **not** rely on **Expo Go** as the primary way to run this project (see below).

---

## 2. When to use each command

| Command | Use it for | Do not use it for |
| --- | --- | --- |
| `npm start` (in `mobile/`) | Starting Metro so the Debug app can load JS. Daily JS development. | Installing or compiling the native `.app`. Fixing “No script URL” by itself if the native install is missing/stale. |
| `npx expo run:ios` | Building/installing the native Debug app and launching it with the Metro URL wired correctly. First run of the day when the app is missing or broken. After native dependency / plugin changes (see §6). | Regenerating the entire `ios/` folder from scratch (that is `prebuild`). |
| `npx expo prebuild` | Regenerating native projects from `app.json` / config plugins when the native project must be recreated or updated from Expo config. Prefer `npx expo prebuild --platform ios` (also available as `npm run prebuild:ios`). | Daily JS-only work. Running instead of `expo run:ios` when you only need to launch. |
| **Xcode** | Debugging native crashes, inspecting build settings, signing, CocoaPods link issues, or opening `mobile/ios/Telefonak.xcworkspace`. Occasional native diagnosis. | Daily JS feature work (prefer Metro + `expo run:ios`). Editing generated native files casually without understanding that `prebuild` may overwrite them. |

### Related scripts in `mobile/package.json`

- `npm start` → `expo start`
- `npm run ios:native` → `expo run:ios`
- `npm run prebuild:ios` → `expo prebuild --platform ios`

---

## 3. Why Expo Go is no longer the primary workflow

Telefonak now ships a **prebuilt native iOS project** (`mobile/ios/`) that matches Expo SDK 54 and includes native modules (for example image picker, fonts, Reanimated / Worklets, datetime picker).

Expo Go is a **generic** client. It does not use Telefonak’s generated `ios/` binary. That means:

- Native module versions in Expo Go can diverge from this repo after package upgrades.
- Launching via Expo Go often shows **“Could not connect to the server”** unless Metro is running **and** Expo Go is opened with the correct project URL (for example `exp://127.0.0.1:8081`).
- The supported Debug path injects the Metro URL into **Telefonak** via `expo run:ios` (including a development-client style deep link). That path is what we verified for Sprint 1.

**Use Expo Go only for quick, optional experiments.** For real feature work, QA, and anything that touches native modules or permissions, use **`npx expo run:ios`** and the **Telefonak** app.

---

## 4. When a native rebuild is required

A **native rebuild** means running `npx expo run:ios` again (Xcode/`xcodebuild` compiles and reinstalls `Telefonak.app`).

Rebuild when:

- You installed, upgraded, or removed a **native** dependency (anything with iOS native code / CocoaPods).
- You changed **Expo config plugins** or native permissions in `app.json`.
- You changed **icons**, **splash**, bundle identifier, or other native resource config that must be compiled into the app.
- The simulator shows **“No script URL provided”** after Metro is already confirmed running (often a stale install).
- You see native/JS version mismatch warnings that affect startup (for example Worklets C++ vs JS version mismatch) after dependency upgrades.
- You cleaned Derived Data / uninstalled the app and need a fresh Debug binary.

You usually **do not** need a native rebuild when:

- You only change JS/TS under `mobile/src/`, styles, navigation, or API calls.
- You only change backend code.
- Metro alone was stopped; restart `npm start` and relaunch Telefonak (or `expo run:ios --no-bundler` if the install is still good).

---

## 5. When to run `prebuild`

`npx expo prebuild` (or `npm run prebuild:ios`) regenerates native project files from Expo config.

Run prebuild when:

- The `mobile/ios/` folder is missing or intentionally deleted.
- `app.json` / app config changes that require regenerating native projects (plugins, permissions, icons, splash, bundle id) and you need those reflected in `ios/`.
- Expo or the team documents that a clean native regeneration is required after a major SDK upgrade.

Avoid running prebuild casually every day. It can overwrite local native customizations. After prebuild:

1. Install pods if needed (Expo/`run:ios` usually handles this).
2. Run `npx expo run:ios` to compile and install.

If you only need to compile the **existing** `ios/` tree, prefer `npx expo run:ios` without prebuild.

---

## 6. Recommended workflow after specific changes

| What you changed | Recommended steps |
| --- | --- |
| **Native dependencies** (`package.json` packages with native code; `expo install …`) | Install JS deps → from `mobile/`: `npx expo run:ios` (lets CocoaPods / native link update). Restart Metro if it was already running (`npm start`). |
| **`app.json`** (name, slug, sdk, ios bundle id, plugins, splash, icon) | If the change affects native output: `npx expo prebuild --platform ios` when regeneration is required, then `npx expo run:ios`. Pure JS-facing metadata may not need prebuild; when unsure, rebuild with `run:ios` and verify. |
| **Native plugins** (entries under `expo.plugins` in `app.json`) | Update `app.json` → `npx expo prebuild --platform ios` (so plugin native changes apply) → `npx expo run:ios`. |
| **Permissions** (e.g. photo library usage strings via plugins) | Same as plugins: prebuild if Info.plist / entitlements must update → `npx expo run:ios`. Confirm the permission string appears in the installed app / system prompt. |
| **Icons** | Update assets referenced by `app.json` → prebuild if needed → `npx expo run:ios`. Uninstall the old app from the simulator if the icon looks cached. |
| **Splash screen** | Update splash asset / `app.json` splash config → prebuild if needed → `npx expo run:ios`. |

Always keep the **backend** running when testing API-backed screens.

---

## 7. Troubleshooting

### “No script URL provided” (native Telefonak)

**Meaning:** The Debug app started without a usable Metro bundle URL.

**Fix:**

1. Confirm Metro: `curl -s http://127.0.0.1:8081/status` should print `packager-status:running`.
2. If Metro is down: `cd mobile && npm start`.
3. Relaunch with the correct workflow (do not rely only on tapping a cold icon after a stale install):

   ```bash
   cd mobile
   npx expo run:ios --device "iPhone 17 Pro" --no-bundler
   ```

4. If it still fails: uninstall `com.telefonak.app` from the simulator, then run `npx expo run:ios` again (full rebuild).

### “Could not connect to the server” (often Expo Go)

**Meaning:** The client cannot reach Metro (or you opened Expo Go without a project URL).

**Fix:**

1. Confirm Metro is running on port 8081.
2. Prefer the native **Telefonak** app + `expo run:ios` instead of Expo Go.
3. If you must use Expo Go on the simulator, open the project URL explicitly (for example `exp://127.0.0.1:8081`) while Metro is running.
4. Do not confuse this with the **backend** being down. Backend failures usually show API/network errors inside the app after JS has already loaded.

### Metro issues

- **Port 8081 in use:** stop the old process, or run `npx expo start` and follow the prompt to use another port (then rebuild/relaunch so the app points at that port).
- **Stale cache:** `cd mobile && npx expo start --clear`.
- **`TypeError: fetch failed` on start:** usually an environment/network restriction around the Expo CLI; retry outside a restricted shell, and ensure `npm_config_devdir` is not pointing at a broken sandbox cache.
- **Keep one Metro** for the project. Avoid starting multiple `expo start` instances on the same port.

### Stale native builds

Symptoms: Worklets / Reanimated native vs JS version warnings, missing native module behavior after `expo install`, icon/splash/permission changes not appearing, or repeated “No script URL” with Metro healthy.

**Fix:**

```bash
cd mobile
# Optional: remove local ios build products only (not source)
rm -rf ios/build

xcrun simctl uninstall booted com.telefonak.app   # or your simulator UDID

npx expo run:ios --device "iPhone 17 Pro"
```

After major config-plugin or `app.json` native changes, run `npx expo prebuild --platform ios` before `run:ios`.

---

## Quick reference

```bash
# Terminal A — API
cd backend && npm run dev

# Terminal B — Metro
cd mobile && npm start

# Terminal C — native Debug app (as needed)
cd mobile && npx expo run:ios --device "iPhone 17 Pro" --no-bundler
```

| Goal | Command |
| --- | --- |
| JS only, Metro already up, app installed | Edit code; reload in the Telefonak app |
| Install / rebuild native Debug app | `npx expo run:ios` |
| Regenerate `ios/` from Expo config | `npx expo prebuild --platform ios` then `npx expo run:ios` |
| Inspect native build in IDE | Open `mobile/ios/Telefonak.xcworkspace` in Xcode |

---

## Related docs

- Initial machine setup: `SETUP.md`
- Project overview: `README.md`
- Architecture: `docs/10_ARCHITECTURE.md`
