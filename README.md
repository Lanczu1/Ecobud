# ECOBUD

ECOBUD is a monorepo implementation of the architecture in [ECOBUD_Architecture.md](ECOBUD_Architecture.md).

## Apps

- `apps/api`: Express + Prisma API (auth, gamification, lessons, challenges, events, transparency, admin, realtime hooks)
- `apps/mobile`: Expo mobile app
- `apps/web`: Flutter public web app
- `apps/web/admin`: React + TypeScript + Vite admin dashboard

## Requirements

- Node.js 18+
- npm 9+
- Flutter SDK 3.3+
- PostgreSQL (local or hosted)
- Android Studio / Expo Go (for mobile testing)

## 1) Run the API (`apps/api`)

1. Create `apps/api/.env` from `apps/api/.env.example`.
2. Set `DATABASE_URL` and other required secrets.
3. Install and start:

```bash
cd apps/api
npm install
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
```

API base URL: `http://localhost:3000`  
API route base used by clients: `http://localhost:3000/api`

## 2) Run the Admin Dashboard (`apps/web/admin`)

1. (Optional) Create `apps/web/admin/.env` from `apps/web/admin/.env.example`.
2. Start Vite:

```bash
cd apps/web/admin
npm install
npm run dev
```

Default URL: `http://localhost:5173`

## 3) Run the Public Web App (`apps/web`)

```bash
cd apps/web
flutter pub get
flutter run -d chrome --web-port 3001
```

URL: `http://localhost:3001`

## 4) Run the Mobile App (`apps/mobile`)

1. Create `apps/mobile/.env` from `apps/mobile/.env.example` (recommended).
2. Start Expo:

```bash
cd apps/mobile
npm install
npm start
```

Notes:

- Android emulator usually works with local API host mapping automatically.
- Mobile session and offline presence queue are stored in a local SQLite-backed store on native (`expo-sqlite`), while web falls back to non-SQLite storage so Expo web bundling stays clean.
- On a physical device, set `EXPO_PUBLIC_API_BASE_URL` to your machine LAN IP, for example:

```bash
EXPO_PUBLIC_API_BASE_URL="http://192.168.1.8:3000/api"
```

## Supabase Realtime Setup

Supabase is used as the live sync layer. Native mobile presence changes are persisted locally in SQLite, then synchronized back into Supabase-powered admin realtime updates when connectivity returns, so the admin `Active Today` card reflects mobile online/offline transitions.

### API env vars (`apps/api/.env`)

```bash
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
SUPABASE_REALTIME_CHANNEL_SECRET="your-realtime-channel-secret"
```

Use a server-side key for `SUPABASE_SERVICE_ROLE_KEY` (not a publishable key).

### Admin env vars (`apps/web/admin/.env`)

```bash
VITE_API_URL="http://localhost:3000/api"
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key"
```

### Mobile env vars (`apps/mobile/.env`)

```bash
EXPO_PUBLIC_API_BASE_URL="http://YOUR_LOCAL_IP:3000/api"
EXPO_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
EXPO_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
```

## Demo Accounts

- Member mobile login: `member@bayanijuan.app / eco12345`
- Admin web login: `admin@bayanijuan.app / admin12345`
- Moderator login: `moderator@bayanijuan.app / moderator123`

## Validation Commands

- API: `cd apps/api && npm run build`
- Admin: `cd apps/web/admin && npm run build`
- Mobile type-check: `cd apps/mobile && npx tsc --noEmit`
- Flutter web analyze: `cd apps/web && flutter analyze`
