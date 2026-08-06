using System.Diagnostics;
using WorkspaceOsConnector.Models;
using WorkspaceOsConnector.Services;

namespace WorkspaceOsConnector.Launchers;

/// <summary>
/// True one-click RDP: redeems the one-time token for decrypted
/// credentials, stashes them in Windows' credential store just long enough
/// for mstsc to pick them up automatically (no password prompt), launches
/// mstsc against a throwaway .rdp file, then scrubs both behind it.
/// </summary>
public sealed class RdpLauncher : ILauncher
{
    public string Kind => "rdp";

    public async Task LaunchAsync(LaunchRequest request, ApiClient api, CancellationToken ct)
    {
        var creds = await api.RedeemRdpTokenAsync(request.Token, ct);
        var target = creds.Port == 3389 ? creds.Host : $"{creds.Host}:{creds.Port}";

        // cmdkey lets mstsc authenticate silently instead of prompting —
        // this is the same mechanism Windows' own "Remote Desktop
        // Connection Manager" and enterprise RDP tools use.
        await RunAsync("cmdkey.exe", $"/generic:TERMSRV/{target} /user:{Escape(creds.Username)} /pass:{Escape(creds.Password)}", ct);

        var rdpFile = Path.Combine(Path.GetTempPath(), $"workspaceos-{Guid.NewGuid():N}.rdp");
        await File.WriteAllTextAsync(rdpFile, BuildRdpFileContents(target, creds.Username), ct);

        try
        {
            var proc = Process.Start(new ProcessStartInfo("mstsc.exe", $"\"{rdpFile}\"") { UseShellExecute = true });
            // Give mstsc a moment to read the cached credential before we
            // scrub it — a launched RDP session doesn't need the cmdkey
            // entry to persist, and leaving it around is unnecessary risk.
            await Task.Delay(TimeSpan.FromSeconds(15), ct);
        }
        finally
        {
            await RunAsync("cmdkey.exe", $"/delete:TERMSRV/{target}", ct);
            try { File.Delete(rdpFile); } catch { /* best effort */ }
        }
    }

    private static string BuildRdpFileContents(string target, string username) => string.Join("\n", new[]
    {
        $"full address:s:{target}",
        $"username:s:{username}",
        "prompt for credentials:i:0",
        "authentication level:i:2",
        "screen mode id:i:2",
    });

    private static string Escape(string value) => value.Contains(' ') ? $"\"{value}\"" : value;

    private static async Task RunAsync(string exe, string args, CancellationToken ct)
    {
        using var proc = Process.Start(new ProcessStartInfo(exe, args)
        {
            UseShellExecute = false,
            CreateNoWindow = true,
        });
        if (proc is not null) await proc.WaitForExitAsync(ct);
    }
}
