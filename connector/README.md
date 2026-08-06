# Workspace OS Connector

A small Windows background app that lets the Workspace OS dashboard launch
native things on your PC — RDP sessions, Anty Browser, AdsPower, Zoiper, Tor
Browser, and anything added later — with one click, instead of a manual
copy-paste of credentials or hunting for the right shortcut.

## How it fits together

```
Dashboard tile click
  -> API mints a one-time connect token
  -> browser navigates to workspaceos://connect?kind=rdp&token=...
  -> Windows hands that URI to WorkspaceOsConnector.exe (registered as the
     workspaceos:// protocol handler)
  -> Connector authenticates to the API with its own long-lived device
     token (never your login session), redeems the one-time token for the
     real connection details, and launches the right thing
```

## Plugin architecture

Everything the Connector can open implements `ILauncher`
(`Launchers/ILauncher.cs`): one method, `LaunchAsync`. `LauncherRegistry`
dispatches by `kind` (the `kind=` query param on the launch URI). Two
launchers exist today:

- **`RdpLauncher`** (`kind=rdp`) — redeems the token for host/port/user/pass,
  stages a throwaway `.rdp` file, and launches `mstsc.exe` with the
  credential cached via `cmdkey` so there's no password prompt. The cached
  credential and temp file are both deleted right after.
- **`GenericExeLauncher`** (`kind=desktop_exe`) — looks up the app's slug
  (`app=` query param) in a local `config.json` mapping slug → installed
  exe path. First launch of an unconfigured app prompts a file picker once;
  the path is remembered after that. No credentials are exchanged for these
  — they're apps you're already logged into locally.

**Adding a new kind of launchable thing never touches existing code.**
Implement `ILauncher`, register it in `Program.cs` (two places: the
URI-launch path and the tray-mode path — both build the same registry).

## Pairing

The Connector authenticates with a device token, not your Google login. To
get one:

1. On the dashboard, go to **Settings → Connector**, click "Generate
   pairing code". You get a code like `WXYZ-1234`, valid 10 minutes.
2. Run `WorkspaceOsConnector.exe` on your PC. First run (or any run while
   unpaired) shows a small dialog — type the code in.
3. The Connector exchanges it for a device token, stores it encrypted
   (Windows DPAPI, current-user scope) at
   `%AppData%\WorkspaceOS\Connector\device.token`, and from then on runs as
   a tray icon.

Revoke access to a lost/old device anytime from the same Settings page —
revoking doesn't touch your login sessions, only that one device's ability
to redeem RDP tokens.

## Building

Requires the .NET 8 SDK on Windows (this can't be built or run on macOS/Linux
— it uses WinForms and the Win32 registry/DPAPI APIs directly).

```
cd connector/src
dotnet build -c Release
```

Output: `bin/Release/net8.0-windows/WorkspaceOsConnector.exe`.

## What's real vs. what's still needed

This is a working v1, not a finished shippable product:

- **No installer.** Right now you run the .exe directly and it registers
  itself. A real distribution needs an MSI/Squirrel/WiX installer that also
  sets it to auto-start at login (currently it only runs when you launch it
  manually, so a reboot loses the tray icon until you run it again).
- **Not code signed.** Windows SmartScreen will warn on first run. Needs an
  Authenticode certificate before sharing this with anyone but yourself.
  Zoiper/AdsPower app paths must currently be set once per machine via the
  file-picker prompt — there's no UI yet to review/edit them afterward
  besides hand-editing `config.json`.
- **No update mechanism.** New Connector versions require manually
  rebuilding and replacing the exe.
- **Single-instance not enforced.** Nothing stops two tray copies running
  at once if you launch the exe twice without args. Low-impact, but worth a
  mutex-based guard eventually.

None of these block trying it end-to-end on your own machine today — they
matter once you want to install this on multiple machines or hand it to
someone else.
