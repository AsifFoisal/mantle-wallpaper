using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.Win32;

public static class MantleRegistry
{
    static readonly string[] Hives = { "HKLM", "HKCU" };

    public static List<Dictionary<string, object>> List()
    {
        var results = new List<Dictionary<string, object>>();
        foreach (var hive in Hives)
        {
            foreach (var view in new[] { RegistryView.Registry64, RegistryView.Registry32 })
            {
                foreach (var path in new[] { @"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall", @"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall" })
                {
                    try
                    {
                        using (var baseKey = (hive == "HKLM" ? RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, view) : RegistryKey.OpenBaseKey(RegistryHive.CurrentUser, view)))
                        using (var uninstall = baseKey.OpenSubKey(path))
                        {
                            if (uninstall == null) continue;
                            foreach (var sub in uninstall.GetSubKeyNames())
                            {
                                try
                                {
                                    using (var key = uninstall.OpenSubKey(sub))
                                    {
                                        if (key == null) continue;
                                        var name = key.GetValue("DisplayName") as string;
                                        if (string.IsNullOrWhiteSpace(name)) continue;
                                        var systemComponent = key.GetValue("SystemComponent");
                                        if (systemComponent is int && (int)systemComponent == 1) continue;
                                        var parent = key.GetValue("ParentKeyName") as string;
                                        if (!string.IsNullOrEmpty(parent)) continue;
                                        results.Add(new Dictionary<string, object>
                                        {
                                            { "name", sub },
                                            { "displayName", name },
                                            { "displayIcon", key.GetValue("DisplayIcon") as string },
                                            { "installLocation", key.GetValue("InstallLocation") as string },
                                            { "publisher", key.GetValue("Publisher") as string },
                                            { "source", hive + @"\" + path + @"\" + sub }
                                        });
                                    }
                                }
                                catch { }
                            }
                        }
                    }
                    catch { }
                }
            }
        }
        return results;
    }
}
