using System.Text.Json;

namespace WorkspaceOsConnector.Config;

/// <summary>
/// Everything the Connector needs that isn't per-launch: the API base URL
/// and, per app slug, the local install path of a native app this specific
/// machine has (Anty Browser, AdsPower, Zoiper, Tor Browser, ...).
/// Deliberately NOT synced from the server — different machines install
/// things in different places, and the server has no business knowing your
/// filesystem layout. Stored at %AppData%\WorkspaceOS\Connector\config.json,
/// hand-edited or edited via a future tray "Configure apps..." dialog.
/// </summary>
public sealed class ConnectorConfig
{
    // Points at the api service domain, not the web dashboard domain.
    public string ApiBaseUrl { get; set; } = "https://iwq0jhxodmhp5w1796e4tt4j.apps.greenroyals.us";

    /// <summary>slug (e.g. "anty-browser") -> absolute exe path + optional args template.</summary>
    public Dictionary<string, AppPath> AppPaths { get; set; } = new();

    private static string ConfigPath =>
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "WorkspaceOS", "Connector", "config.json");

    public static ConnectorConfig LoadOrDefault()
    {
        try
        {
            if (File.Exists(ConfigPath))
            {
                var json = File.ReadAllText(ConfigPath);
                var loaded = JsonSerializer.Deserialize<ConnectorConfig>(json);
                if (loaded is not null) return loaded;
            }
        }
        catch
        {
            // Corrupt config shouldn't crash the app — fall through to defaults.
        }
        return new ConnectorConfig();
    }

    public void Save()
    {
        Directory.CreateDirectory(Path.GetDirectoryName(ConfigPath)!);
        var json = JsonSerializer.Serialize(this, new JsonSerializerOptions { WriteIndented = true });
        File.WriteAllText(ConfigPath, json);
    }
}

public sealed class AppPath
{
    public string ExePath { get; set; } = "";
    public string? ArgsTemplate { get; set; } // e.g. "--profile={profile}"
}
