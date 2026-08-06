using WorkspaceOsConnector.Config;
using WorkspaceOsConnector.Launchers;
using WorkspaceOsConnector.Models;
using WorkspaceOsConnector.Pairing;
using WorkspaceOsConnector.Services;

namespace WorkspaceOsConnector;

internal static class Program
{
    [STAThread]
    private static async Task<int> Main(string[] args)
    {
        ApplicationConfiguration.Initialize();

        var config = ConnectorConfig.LoadOrDefault();
        ProtocolRegistrar.EnsureRegistered();

        // Invoked as `WorkspaceOsConnector.exe "workspaceos://connect?..."`
        // by the OS when a dashboard tile is clicked — do the one launch
        // and exit. This is the common case once paired.
        var uriArg = args.FirstOrDefault(a => a.StartsWith("workspaceos://", StringComparison.OrdinalIgnoreCase));
        if (uriArg is not null)
        {
            return await HandleLaunchAsync(config, uriArg);
        }

        // No args: either first install (run pairing) or the user
        // double-clicked the exe directly. Either way, end up as a tray
        // icon so there's a visible, persistent "Connector is running".
        var paired = await PairingFlow.RunIfNeededAsync(config);
        if (!paired)
        {
            return 1; // user cancelled pairing; nothing to run for
        }

        RunTray(config);
        return 0;
    }

    private static async Task<int> HandleLaunchAsync(ConnectorConfig config, string uriArg)
    {
        try
        {
            if (!DeviceStore.HasToken())
            {
                var paired = await PairingFlow.RunIfNeededAsync(config);
                if (!paired) return 1;
            }

            var request = LaunchRequest.Parse(new Uri(uriArg));
            var api = new ApiClient(config, DeviceStore.LoadToken());

            var registry = new LauncherRegistry();
            registry.Register(new RdpLauncher());
            registry.Register(new GenericExeLauncher(config, PromptForExePath));

            await registry.DispatchAsync(request, api, CancellationToken.None);
            return 0;
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Couldn't launch:\n\n{ex.Message}", "Workspace OS Connector",
                MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
    }

    private static string? PromptForExePath(string slug)
    {
        using var dialog = new OpenFileDialog
        {
            Title = $"Locate the app for \"{slug}\" (asked once, remembered after)",
            Filter = "Applications (*.exe)|*.exe|All files (*.*)|*.*",
        };
        return dialog.ShowDialog() == DialogResult.OK ? dialog.FileName : null;
    }

    private static void RunTray(ConnectorConfig config)
    {
        var registry = new LauncherRegistry();
        registry.Register(new RdpLauncher());
        registry.Register(new GenericExeLauncher(config, PromptForExePath));

        using var icon = new NotifyIcon
        {
            Icon = System.Drawing.SystemIcons.Application,
            Visible = true,
            Text = "Workspace OS Connector",
        };

        var menu = new ContextMenuStrip();
        menu.Items.Add("Workspace OS Connector — running", null, (_, _) => { }).Enabled = false;
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Re-pair this device", null, async (_, _) =>
        {
            DeviceStore.Clear();
            await PairingFlow.RunIfNeededAsync(config);
        });
        menu.Items.Add("Exit", null, (_, _) => Application.Exit());
        icon.ContextMenuStrip = menu;

        Application.Run();
    }
}
