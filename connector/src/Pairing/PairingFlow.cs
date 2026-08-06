using WorkspaceOsConnector.Config;
using WorkspaceOsConnector.Services;

namespace WorkspaceOsConnector.Pairing;

/// <summary>
/// First-run setup: shows a small dialog asking for the pairing code from
/// Settings > Connector on the dashboard, exchanges it for a device token,
/// stores it (encrypted) via DeviceStore. Everything after this call
/// treats the Connector as paired.
/// </summary>
public static class PairingFlow
{
    public static async Task<bool> RunIfNeededAsync(ConnectorConfig config)
    {
        if (DeviceStore.HasToken()) return true;

        using var dialog = new PairingDialog();
        if (dialog.ShowDialog() != DialogResult.OK) return false;

        var api = new ApiClient(config, deviceToken: null);
        var result = await api.PairAsync(dialog.Code, dialog.DeviceName, CancellationToken.None);
        DeviceStore.SaveToken(result.DeviceToken);
        return true;
    }
}

/// <summary>Minimal WinForms dialog — two text fields, OK/Cancel.</summary>
internal sealed class PairingDialog : Form
{
    private readonly TextBox _codeBox = new() { PlaceholderText = "XXXX-XXXX" };
    private readonly TextBox _nameBox = new() { Text = Environment.MachineName };

    public string Code => _codeBox.Text.Trim().ToUpperInvariant();
    public string DeviceName => string.IsNullOrWhiteSpace(_nameBox.Text) ? Environment.MachineName : _nameBox.Text.Trim();

    public PairingDialog()
    {
        Text = "Pair Workspace OS Connector";
        Width = 380;
        Height = 220;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        StartPosition = FormStartPosition.CenterScreen;
        MaximizeBox = false;
        MinimizeBox = false;

        var codeLabel = new Label { Text = "Pairing code (from Settings > Connector):", AutoSize = true, Top = 20, Left = 20 };
        _codeBox.Top = 45; _codeBox.Left = 20; _codeBox.Width = 320;

        var nameLabel = new Label { Text = "Device name:", AutoSize = true, Top = 85, Left = 20 };
        _nameBox.Top = 110; _nameBox.Left = 20; _nameBox.Width = 320;

        var ok = new Button { Text = "Pair", DialogResult = DialogResult.OK, Top = 145, Left = 180, Width = 80 };
        var cancel = new Button { Text = "Cancel", DialogResult = DialogResult.Cancel, Top = 145, Left = 265, Width = 75 };

        Controls.AddRange(new Control[] { codeLabel, _codeBox, nameLabel, _nameBox, ok, cancel });
        AcceptButton = ok;
        CancelButton = cancel;
    }
}
