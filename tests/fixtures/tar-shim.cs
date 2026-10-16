using System;
using System.Diagnostics;
using System.IO;

class TarShim
{
    static int Main(string[] args)
    {
        var countFile = Environment.GetEnvironmentVariable("BACKUP_TEST_COUNT");
        var failures = int.Parse(Environment.GetEnvironmentVariable("BACKUP_TEST_FAILURES") ?? "0");
        var count = 0;
        if (File.Exists(countFile)) int.TryParse(File.ReadAllText(countFile), out count);
        count++;
        File.WriteAllText(countFile, count.ToString());
        if (count <= failures)
        {
            Console.Error.WriteLine("fictional packing failure");
            return 2;
        }
        var tar = Environment.GetEnvironmentVariable("BACKUP_TEST_TAR");
        var psi = new ProcessStartInfo(tar) { UseShellExecute = false, RedirectStandardOutput = true, RedirectStandardError = true };
        psi.Arguments = string.Join(" ", Array.ConvertAll(args, Quote));
        using (var child = Process.Start(psi))
        {
            child.StandardOutput.BaseStream.CopyTo(Console.OpenStandardOutput());
            child.StandardError.BaseStream.CopyTo(Console.OpenStandardError());
            child.WaitForExit();
            return child.ExitCode;
        }
    }

    static string Quote(string arg) { return "\"" + arg.Replace("\\", "\\\\").Replace("\"", "\\\"") + "\""; }
}
