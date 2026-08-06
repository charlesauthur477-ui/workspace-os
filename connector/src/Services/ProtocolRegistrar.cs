using Microsoft.Win32;

namespace WorkspaceOsConnector.Services;

/// <summary>
/// Registers workspaceos:// as a custom URI scheme handled by this exe,
/// under HKEY_CURRENT_USER so no admin elevation is needed. Idempotent —
/// safe to call on every startup.
/// </summary>
public static class ProtocolRegistrar
{
    private const string SchemeName = "workspaceos";

    public static void EnsureRegistered()
    {
        var exePath = Environment.ProcessPath ?? Environment.GetCommandLineArgs()[0];

        using var root = Registry.CurrentUser.CreateSubKey($@"Software\Classes\{SchemeName}");
        root.SetValue("", $"URL:Workspace OS Connector Protocol");
        root.SetValue("URL Protocol", "");

        using var icon = root.CreateSubKey("DefaultIcon");
        icon.SetValue("", $"\"{exePath}\",0");

        using var command = root.CreateSubKey(@"shell\open\command");
        command.SetValue("", $"\"{exePath}\" \"%1\"");
    }
}
