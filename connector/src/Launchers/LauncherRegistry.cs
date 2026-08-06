using WorkspaceOsConnector.Models;
using WorkspaceOsConnector.Services;

namespace WorkspaceOsConnector.Launchers;

public sealed class LauncherRegistry
{
    private readonly Dictionary<string, ILauncher> _byKind = new(StringComparer.OrdinalIgnoreCase);

    public void Register(ILauncher launcher) => _byKind[launcher.Kind] = launcher;

    public async Task DispatchAsync(LaunchRequest request, ApiClient api, CancellationToken ct)
    {
        if (!_byKind.TryGetValue(request.Kind, out var launcher))
        {
            throw new InvalidOperationException(
                $"No launcher registered for kind '{request.Kind}'. Known kinds: {string.Join(", ", _byKind.Keys)}");
        }

        await launcher.LaunchAsync(request, api, ct);
    }
}
