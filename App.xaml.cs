using System.Windows;
using NovaGameSpace.Services;

[assembly: ThemeInfo(ResourceDictionaryLocation.None, ResourceDictionaryLocation.SourceAssembly)]

namespace NovaGameSpace;

public sealed partial class App : System.Windows.Application
{
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        AppPaths.Ensure();
        Log.Write("app start");
        var window = new MainWindow();
        MainWindow = window;
        window.Show();
    }
}
