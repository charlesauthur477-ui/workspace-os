using WorkspaceOsConnector.Models;
using WorkspaceOsConnector.Services;

namespace WorkspaceOsConnector.Launchers;

/// <summary>
/// The whole plugin contract. Every kind of "thing the Connector can open"
/// — an RDP session, a native app like Anty Browser, a future VNC/SSH
/// target — implements this. LauncherRegistry picks the right one by
/// <see cref="Kind"/>; nothing else in the app needs to know launcher
/// internals. Adding a new launcher is: implement this interface, register
/// it in Program.cs. No other file changes.
/// </summary>
public interface ILauncher
{
    /// <summary>Matches LaunchRequest.Kind, e.g. "rdp", "desktop_exe".</summary>
    string Kind { get; }

    Task LaunchAsync(LaunchRequest request, ApiClient api, CancellationToken ct);
}
