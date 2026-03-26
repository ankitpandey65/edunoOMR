# Eduno Exam Desktop (One-Click)

This project can run as a desktop app for macOS and Windows using Electron.

## What this gives you

- One-click launch application window
- Local server starts automatically in background
- Local SQLite database stored in user app data folder
- Automatic port conflict handling (reuses running server or picks free port)
- Desktop menu shortcuts for data/config access
- Optional update checks from your own manifest URL

## First-time setup

```bash
npm install
npm run build
```

## Run locally as desktop app

```bash
npm run desktop:dev
```

## Build installers

```bash
npm run desktop:dist
```

Artifacts are created in `dist-desktop/`:

- macOS: `.dmg`
- Windows: `.exe` (NSIS one-click installer)

Platform-specific build:

```bash
npm run desktop:dist:mac
npm run desktop:dist:win
```

Windows x64 explicit:

```bash
npm run desktop:dist:win:x64
```

The Windows output file name is:

- `dist-desktop/Eduno-Exam-Setup-<version>-x64.exe`

This is the one file you can share by email/drive with users.
Users just run it once and the app installs and launches automatically.

## Desktop config file

On first launch, app creates:

- `desktop-config.json` inside user app data folder

Use app menu:

- `File -> Open Desktop Config`
- `File -> Open Data Folder`

Sample config template:

- `electron/desktop-config.sample.json`

Fields:

- `port`: preferred app port (default `3000`)
- `openAiApiKey`: optional key if you do not want OS env var
- `openAiOmrModel`: optional model override
- `autoCheckUpdates`: true/false
- `updateManifestUrl`: URL to JSON manifest
- `updateDownloadUrl`: fallback download URL

## Update manifest format

Host a JSON file (for example at your own server/CDN):

```json
{
  "version": "0.1.1",
  "notes": "Bug fixes and better scan speed",
  "url": "https://example.com/EdunoExamInstaller"
}
```

When a newer version exists, app shows a prompt and opens the download URL.

## Notes

- App DB file is created at runtime in the user's app data folder and is writable.
- For branded installer icons, add icon assets later (`.icns` for macOS and `.ico` for Windows) and set icon paths in `package.json -> build`.

## CI build for Windows installer (recommended from Mac)

This repo includes:

- `.github/workflows/windows-installer.yml`

How to use:

1. Push code to GitHub.
2. Open GitHub Actions -> `Build Windows Installer`.
3. Run workflow (`workflow_dispatch`).
4. Download artifact `Eduno-Exam-Windows-Installer`.

That artifact contains the `.exe` installer ready to send to users.

## Auto-release with single shareable link

This repo now also includes:

- `.github/workflows/windows-release.yml`

Use this when you want GitHub to create a Release and attach installer files automatically.

Option A (recommended):

1. Push tag from local:
   - `git tag v0.1.0`
   - `git push origin v0.1.0`
2. Workflow runs automatically on tag push.
3. GitHub Release is created with attached `.exe`.

Option B:

1. Open GitHub Actions -> `Release Windows Installer`.
2. Run manually with tag input (example: `v0.1.0`).
3. Workflow builds and publishes release assets.
