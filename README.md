# PassNest

PassNest is a local-first desktop password manager built with Electron and TypeScript.

It stores encrypted password entries locally, organizes them by profile, and only exposes secrets through explicit copy actions instead of showing plaintext in the UI.

## Current Status

PassNest is in active development and is currently version `0.0.1`.

## Features

- Local-first desktop app with Electron
- Profile-based grouping for saved entries
- Encrypted password storage
- Copy-to-clipboard workflow for password use
- Custom app icons for dev and packaged builds
- Packaged app generation with `electron-builder`

## Project Structure

```text
src/main/       Electron main process, database, crypto, IPC, platform code
src/preload/    Secure renderer bridge
src/renderer/   UI entrypoint, HTML, styles, and app assets
src/shared/     DTOs and validation shared across layers
scripts/        Project utility scripts such as icon generation
build/icons/    Generated packaging icons (.icns, .ico, PNG sizes)
release/        Packaged app outputs
```

## Requirements

- Node.js
- npm
- macOS tooling is currently used for the icon pipeline and macOS packaging

## Development

Install dependencies:

```bash
npm install
```

Type-check the project:

```bash
npm run check
```

Build the TypeScript outputs:

```bash
npm run build
```

Start the app in development:

```bash
npm run start
```

## Packaging

Generate packaging icons:

```bash
npm run generate:icons
```

Build an unpacked app directory:

```bash
npm run pack
```

Build distributables for the current platform:

```bash
npm run dist
```

Build a macOS DMG:

```bash
npm run dist:mac
```

Build a Windows installer:

```bash
npm run dist:win
```

Packaged output is written to `release/`.

## Icons

The source app artwork lives in:

- `src/renderer/assets/passnest-icon.svg`
- `src/renderer/assets/passnest-icon.png`

Generated packaging assets are produced by:

- `scripts/generate-icons.py`

That script creates:

- `build/icons/passnest.icns`
- `build/icons/passnest.ico`
- multi-size PNG assets used by OS packaging formats

## Local Data

PassNest stores application data under:

```text
~/.config/passnest-desktop
```

This includes the local database and trusted-device secret material used by the app.

## Security Notes

- Password entries are designed to be stored encrypted rather than as plaintext
- The canonical secret storage model is local and user-controlled
- OS secure storage is treated as a convenience layer, not the source of truth

## Additional Docs

- `design-doc.md`
- `implementation-spec.md`
