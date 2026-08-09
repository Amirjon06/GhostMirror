# Desktop Packaging

GhostMirror currently runs as a local web dashboard backed by a local API. Desktop packaging is planned so the application can be launched as a normal desktop app.

## Current Status

Desktop packaging is not implemented yet.

The current local workflow is:

```bash
./scripts/monitor.sh
```

This starts the API, dashboard, and clipboard monitor. It can also start filesystem monitoring when a directory is provided:

```bash
./scripts/monitor.sh /path/to/workspace
```

## Planned Runtime

The planned desktop runtime is Tauri.

Expected responsibilities:

- Launch the React dashboard in a native window.
- Start or connect to the local FastAPI service.
- Keep SQLite data on the local machine.
- Provide local controls for clipboard and filesystem monitoring.
- Package the app for local installation.

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

## Packaging Plan

- Add a Tauri shell around the existing React app.
- Keep the existing FastAPI API as the backend service.
- Decide how the desktop app starts and stops the API process.
- Store application data in a stable local app data directory.
- Add a packaging check to CI after the desktop project exists.
