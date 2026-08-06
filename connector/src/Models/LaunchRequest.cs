namespace WorkspaceOsConnector.Models;

/// <summary>
/// Parsed form of a workspaceos://connect?... URI. "Kind" is what the
/// LauncherRegistry dispatches on — new kinds (e.g. "vnc", "ssh") just mean
/// a new ILauncher implementation, never a change to this type or to how
/// the URI is parsed.
/// </summary>
public sealed record LaunchRequest(string Kind, string Token, IReadOnlyDictionary<string, string> Extra)
{
    public static LaunchRequest Parse(Uri uri)
    {
        // workspaceos://connect?kind=rdp&token=abc123
        var query = System.Web.HttpUtility.ParseQueryString(uri.Query);
        var kind = query["kind"] ?? "rdp"; // default for back-compat with early tokens
        var token = query["token"] ?? throw new ArgumentException("Missing token in launch URI");

        var extra = new Dictionary<string, string>();
        foreach (string? key in query.AllKeys)
        {
            if (key is null || key is "kind" or "token") continue;
            extra[key] = query[key] ?? "";
        }

        return new LaunchRequest(kind, token, extra);
    }
}
