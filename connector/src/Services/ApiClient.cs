using System.Net.Http.Headers;
using System.Net.Http.Json;
using WorkspaceOsConnector.Config;

namespace WorkspaceOsConnector.Services;

public sealed class ApiClient
{
    private readonly HttpClient _http;

    public ApiClient(ConnectorConfig config, string? deviceToken)
    {
        _http = new HttpClient { BaseAddress = new Uri(config.ApiBaseUrl) };
        if (deviceToken is not null)
        {
            // Custom scheme, not Bearer — the API tells requireAuth (user
            // sessions) and requireDeviceAuth (this) apart by the scheme.
            _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Device", deviceToken);
        }
    }

    public async Task<PairResult> PairAsync(string code, string deviceName, CancellationToken ct)
    {
        var res = await _http.PostAsJsonAsync("/connector/pair/redeem", new { code, deviceName }, ct);
        res.EnsureSuccessStatusCode();
        var result = await res.Content.ReadFromJsonAsync<PairResult>(cancellationToken: ct);
        return result ?? throw new InvalidOperationException("Empty pairing response");
    }

    public async Task<RdpCredentials> RedeemRdpTokenAsync(string token, CancellationToken ct)
    {
        var res = await _http.PostAsJsonAsync("/rdp/connector/redeem", new { token }, ct);
        res.EnsureSuccessStatusCode();
        var result = await res.Content.ReadFromJsonAsync<RdpCredentials>(cancellationToken: ct);
        return result ?? throw new InvalidOperationException("Empty redeem response");
    }

    public async Task<LaunchConfig> GetLaunchConfigAsync(CancellationToken ct)
    {
        var res = await _http.GetAsync("/connector/launch-config", ct);
        res.EnsureSuccessStatusCode();
        var result = await res.Content.ReadFromJsonAsync<LaunchConfig>(cancellationToken: ct);
        return result ?? new LaunchConfig();
    }
}

public sealed record PairResult(string DeviceToken, string DeviceId);

public sealed record RdpCredentials(string Host, int Port, string Username, string Password);

public sealed class LaunchConfig
{
    public List<RdpSummary> Rdps { get; set; } = new();
    public List<DesktopAppSummary> DesktopApps { get; set; } = new();
}

public sealed record RdpSummary(string Id, string Name, string Host, int Port, string? GroupName);

public sealed class DesktopAppSummary
{
    public string Id { get; set; } = "";
    public string Slug { get; set; } = "";
    public string Name { get; set; } = "";
}
