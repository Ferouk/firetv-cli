# firetv

<p align="center">
  <img src="./firetv_cli.png" alt="firetv CLI" width="320">
</p>

Command-line tools for controlling and managing Amazon Fire TV devices through Android Debug Bridge (ADB).

## Features

- Connect to Fire TV devices over network ADB
- Use an interactive command prompt or individual commands
- Navigate the Fire TV remote, control playback, volume, and text input
- List, inspect, open, close, install, uninstall, and clear apps
- Capture screenshots
- Safely preview and apply debloating, telemetry, launcher, and quality-of-life changes
- Create and restore device backups

## Requirements

- Node.js 18 or newer
- Yarn
- A Fire TV with ADB debugging enabled

The CLI uses a bundled `adb` executable when one is available for your platform. On unsupported platforms, it falls back to a system `adb`; you can force that behavior with `USE_SYSTEM_ADB=1`. You can also install Platform-Tools from the [Android developer website](https://developer.android.com/tools/releases/platform-tools) if needed.

## Installation

```bash
yarn install
yarn build
```

Run the CLI locally with:

```bash
yarn dev
```

After building, the executable is available at `dist/cli.js`. To install it as a global command from this project:

```bash
npm link
firetv --help
```

## Enable ADB debugging and find the Fire TV IP address

On the Fire TV:

1. Open **Settings** → **My Fire TV** → **About**.
2. Select your Fire TV device name seven times to reveal **Developer Options** (if it is not already visible).
3. Go back to **My Fire TV** → **Developer Options** and turn on **ADB Debugging**.
4. Open **Settings** → **My Fire TV** → **About** → **Network** and note the **IP Address**.

Make sure your Mac running `firetv` and the Fire TV are connected to the same network. Fire TV menus may use **Network** directly under **Settings** on some versions.

## Connect a device

Enable ADB debugging on the Fire TV, note its IP address, and connect:

```bash
firetv connect 192.168.1.42 --name "Living Room"
firetv status
```

The address is normalized to port `5555` when no port is supplied. The selected device is stored in `~/.config/firetv/config.json`.

To inspect or select devices discovered by ADB:

```bash
firetv device list
firetv device use 192.168.1.42:5555
```

## Usage

Start the interactive prompt:

```bash
firetv interactive
# alias: firetv shell
```

Common commands:

```bash
# Device
firetv status
firetv reboot
firetv disconnect

# Remote
firetv home
firetv up
firetv select
firetv play-pause
firetv volume-up
firetv type "Search text"
firetv remote

# Apps
firetv apps
firetv apps --user
firetv open "YouTube"
firetv app-info "YouTube"
firetv install ./app.apk
firetv uninstall "YouTube"
firetv clear "YouTube"

# Media
firetv screenshot ./screen.png

# Backups
firetv backup create
firetv backup list
firetv restore --input ./backup.json
```

App names may be labels or package names, depending on what is installed on the device.

## Device management

Management commands show a preview before making changes. Add `--apply` to apply the preview directly; otherwise the CLI asks for confirmation. Use `--yes` to skip confirmation when supported.

```bash
# Review package profiles and current state
firetv debloat list
firetv debloat list --tier SAFE
firetv debloat status

# Apply package and telemetry changes
firetv debloat run --preset safe --apply
firetv debloat disable com.example.package --apply
firetv debloat enable com.example.package --apply
firetv telemetry status
firetv telemetry strip --apply

# Apply quality-of-life settings
firetv settings status
firetv settings apply --apply

# Manage launchers
firetv launcher list
firetv launcher status
firetv launcher set com.spocky.projengmenu --apply
firetv launcher restore --activity <package>/<activity> --apply
```

Backups are created automatically before launcher and debloat plans are applied. They are stored under `~/.config/firetv/backups/`.

Review every preview carefully. Disabling packages or changing the HOME launcher can affect device behavior; the package profile protects entries marked `NEVER_TOUCH`.

## Development

```bash
yarn dev              # Run from TypeScript sources
yarn build            # Compile to dist/
yarn typecheck       # Type-check without emitting
yarn test             # Run tests
yarn lint             # Run ESLint
yarn format:check     # Check formatting
```

## License

This project is licensed under the [MIT License](./LICENSE). See
[CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines.
