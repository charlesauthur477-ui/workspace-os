using System.Security.Cryptography;
using System.Text;

namespace WorkspaceOsConnector.Config;

/// <summary>
/// Holds the long-lived device token issued at pairing time. Encrypted at
/// rest with Windows DPAPI (CurrentUser scope) — readable only by this
/// Windows account on this machine, never written in plaintext.
/// </summary>
public static class DeviceStore
{
    private static string TokenPath =>
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "WorkspaceOS", "Connector", "device.token");

    public static bool HasToken() => File.Exists(TokenPath);

    public static string? LoadToken()
    {
        if (!File.Exists(TokenPath)) return null;
        var encrypted = File.ReadAllBytes(TokenPath);
        var plain = ProtectedData.Unprotect(encrypted, null, DataProtectionScope.CurrentUser);
        return Encoding.UTF8.GetString(plain);
    }

    public static void SaveToken(string token)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(TokenPath)!);
        var plain = Encoding.UTF8.GetBytes(token);
        var encrypted = ProtectedData.Protect(plain, null, DataProtectionScope.CurrentUser);
        File.WriteAllBytes(TokenPath, encrypted);
    }

    public static void Clear()
    {
        if (File.Exists(TokenPath)) File.Delete(TokenPath);
    }
}
