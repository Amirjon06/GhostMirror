# Desktop Packaging

GhostMirror includes a Tauri desktop shell around the React dashboard. The current desktop app opens the dashboard in a native window and connects to the local FastAPI service.

## Current Status

The desktop app scaffold is implemented in `apps/web/src-tauri`.

The packaged macOS app bundle can be downloaded from:

```text
https://github.com/Amirjon06/GhostMirror/releases/download/v0.2.0/GhostMirror_0.2.0_macos_arm64.zip
```

The development command starts the FastAPI API and Vite dashboard for the Tauri window:

```bash
cd apps/web
npm run desktop:dev
```

The package command builds a macOS app bundle:

```bash
cd apps/web
npm run desktop:build
```

The app bundle is written to:

```text
apps/web/src-tauri/target/release/bundle/macos/GhostMirror.app
```

For local use, start the API before opening the packaged app:

```bash
./scripts/api.sh
open apps/web/src-tauri/target/release/bundle/macos/GhostMirror.app
```

## Runtime

The desktop runtime uses Tauri.

Current responsibilities:

- Launch the React dashboard in a native window.
- Start the FastAPI service during desktop development.
- Keep SQLite data on the local machine.
- Build a macOS `.app` bundle.

The packaged desktop app still expects the FastAPI service to be available locally. A DMG installer and bundled API sidecar are not included in the current release.

## Local Requirements

Tauri requires the Rust toolchain.

Check local prerequisites:

```bash
./scripts/doctor.sh
```

If Rust is missing, install it from:

```text
https://www.rust-lang.org/tools/install
```

After installing Rust, restart the terminal and run:

```bash
rustc --version
cargo --version
```

## Files

- `apps/web/src-tauri/tauri.conf.json` defines the desktop window, dev server, and bundle settings.
- `apps/web/src-tauri/src` contains the Rust entry point for the Tauri shell.
- `scripts/desktop-dev.sh` starts the local API and dashboard for desktop development.
- `scripts/api.sh` starts the local API for use with the packaged app.
