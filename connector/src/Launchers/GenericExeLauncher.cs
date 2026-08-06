using System.Diagnostics;
using WorkspaceOsConnector.Config;
using WorkspaceOsConnector.Models;
using WorkspaceOsConnector.Services;

namespace WorkspaceOsConnector.Launchers;

/// <summary>
/// Launches any locally installed native app — Anty Browser, AdsPower,
/// Zoiper, Tor Browser, and anything added later — by looking up its slug
/// (passed as an "app" query param on the workspaceos:// URI) in the local
/// AppPaths config. No credential exchange: these are apps you're already
/// logged into on this machine, so there's nothing for the server to hand
/// over. If the path isn't configured yet, it prompts once and saves it,
/// so it's a one-time setup per app per machine.
/// </summary>
public sealed class GenericExeLauncher : ILauncher
{
    private readonly ConnectorConfig _config;
    private readonly Func<string, string?> _promptForPath;

    public GenericExeLauncher(ConnectorConfig config, Func<string, string?> promptForPath)
    {
        _config = config;
        _promptForPath = promptForPath;
    }

    public string Kind => "desktop_exe";

    public Task LaunchAsync(LaunchRequest request, ApiClient api, CancellationToken ct)
    {
        if (!request.Extra.TryGetValue("app", out var slug) || string.IsNullOrWhiteSpace(slug))
        {
            throw new ArgumentException("desktop_exe launch requires an 'app' query param (the app slug).");
        }

        if (!_config.AppPaths.TryGetValue(slug, out var appPath) || !File.Exists(appPath.ExePath))
        {
            var chosen = _promptForPath(slug);
            if (chosen is null) return Task.CompletedTask; // user cancelled
            appPath = new AppPath { ExePath = chosen };
            _config.AppPaths[slug] = appPath;
            _config.Save();
        }

        var args = appPath.ArgsTemplate is null
            ? ""
            : ApplyTemplate(appPath.ArgsTemplate, request.Extra);

        Process.Start(new ProcessStartInfo(appPath.ExePath, args) { UseShellExecute = true });
        return Task.CompletedTask;
    }

    private static string ApplyTemplate(string template, IReadOnlyDictionary<string, string> vars)
    {
        var result = template;
        foreach (var (key, value) in vars)
        {
            result = result.Replace($"{{{key}}}", value);
        }
        return result;
    }
}
