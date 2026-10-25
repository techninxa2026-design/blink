# Blink Flutter Android

Native Flutter Android client for Blink, sharing the existing NestJS API and Prisma/MySQL database.

This directory is the dedicated Flutter workspace. It does not modify the React web app or NestJS API.

## Local setup

1. Install Flutter SDK and Android SDK.
2. From this directory, run `flutter create --platforms=android --project-name blink_android .` to generate platform scaffolding if it is not present.
3. Run `flutter pub get`.
4. Start the existing NestJS API and run `flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000` in an Android emulator. On a physical phone, use the reachable LAN/HTTPS API address instead.

The initial application skeleton is not yet a feature-complete port. Screens and endpoints will be migrated against the existing web source.
