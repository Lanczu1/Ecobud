# ECOBUD

ECOBUD is a monorepo implementation of the architecture in [ECOBUD_Architecture.md](ECOBUD_Architecture.md), with:

- `apps/api`: Express + Prisma API with gamification, lessons, challenges, events, transparency logging, and admin endpoints
- `apps/mobile`: Expo mobile app styled from the provided reference screens
- `apps/web`: Flutter web landing page plus embedded admin portal

## Requirements

- Node.js 18+
- Flutter SDK 3.3+
- XAMPP MySQL / MariaDB running on `127.0.0.1:3306`
- Android Studio / Expo Go for mobile testing

## 1. Run the API

```bash
cd apps/api
npm install
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
```

The API runs on `http://localhost:3000`.

The local database is MySQL through XAMPP and is configured in [apps/api/.env](/c:/xampp/htdocs/Ecobud/apps/api/.env) as `mysql://root:@127.0.0.1:3306/ecobud`.

You can inspect the database in either:

- `http://localhost/phpmyadmin`
- `npx prisma studio`

## 2. Run the web app

```bash
cd apps/web
flutter pub get
flutter run -d chrome --web-port 3001
```

Open `http://localhost:3001`.

The public landing page includes:

- hero / product marketing
- transparency dashboard
- admin portal section with login, overview, users, lesson management, challenge management, and event management

## 3. Run the mobile app

```bash
cd apps/mobile
npm install
npm start
```

Notes:

- Android emulator uses `10.0.2.2:3000` automatically
- Expo Go on a physical phone should use your computer LAN IP, for example:

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.8:3000/api
```

## Demo accounts

- Member mobile login: `lanczu@ecobud.app / eco12345`
- Admin web login: `admin@ecobud.app / admin12345`
- Moderator login: `moderator@ecobud.app / moderator123`

## Validation

- API: `npm run build`
- Mobile: `npx tsc --noEmit`
- Web: `flutter analyze`
