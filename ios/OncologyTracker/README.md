# Oncology iOS App

Native iOS shell for Oncology Tracker.

## What this app does

- Opens the production tracker at `https://oncology-tracker.vercel.app/` in a native `WKWebView`.
- Adds a native workout reminder screen backed by iOS local notifications.
- Stores only reminder preferences in `UserDefaults`.
- Keeps all study data in the existing web app / Firebase flow.

## Project

- Project: `OncologyTracker.xcodeproj`
- Scheme: `Oncology`
- Bundle ID: `com.ubumenaomi.oncologytracker`
- Minimum target: iOS 17

## Run locally

Open `OncologyTracker.xcodeproj` in Xcode, select the `Oncology` scheme, then run on a simulator or your iPhone.

For command-line simulator builds:

```sh
xcodebuild \
  -project ios/OncologyTracker/OncologyTracker.xcodeproj \
  -scheme Oncology \
  -configuration Debug \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath /private/tmp/oncology-tracker-derived-data \
  build CODE_SIGNING_ALLOWED=NO
```

For a physical iPhone, select your development team in Xcode signing settings before running.
