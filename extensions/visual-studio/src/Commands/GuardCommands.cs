// GuardCommands.cs
//
// Menu command handlers: ScanSelection, ScanDocument, RedactSelection, BrokerStatus.
// Each handler gathers editor text, calls the broker, and shows a result. No
// detection or redaction is performed locally.
//
// STATUS: PLANNED / UNBUILT. Idiomatic against the classic VS SDK; NOT compiled here.

using System;
using System.ComponentModel.Design;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.VisualStudio.ComponentModelHost;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Interop;
using Microsoft.VisualStudio.Text;
using Microsoft.VisualStudio.Text.Editor;
using Microsoft.VisualStudio.TextManager.Interop;
using SoterAI.Guard.Broker;
using Task = System.Threading.Tasks.Task;

namespace SoterAI.Guard.Commands
{
    /// <summary>
    /// Owns the four SoterAI menu commands and their broker interaction.
    /// </summary>
    internal sealed class GuardCommands
    {
        // Command set GUID and IDs must match SoterAIGuardPackage.vsct.
        public static readonly Guid CommandSet = new Guid("6f2a9b71-3c8e-4d5a-b1c2-7e9d0a4f3b12");
        public const int ScanSelectionId = 0x0100;
        public const int ScanDocumentId = 0x0101;
        public const int RedactSelectionId = 0x0102;
        public const int BrokerStatusId = 0x0103;
        public const int CheckEgressId = 0x0104;

        private readonly SoterAIGuardPackage _package;

        private GuardCommands(SoterAIGuardPackage package)
        {
            _package = package ?? throw new ArgumentNullException(nameof(package));
        }

        public static async Task InitializeAsync(SoterAIGuardPackage package)
        {
            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(package.DisposalToken);

            var commandService = await package.GetServiceAsync(typeof(IMenuCommandService))
                as OleMenuCommandService;
            if (commandService == null)
            {
                return;
            }

            var handler = new GuardCommands(package);
            handler.Register(commandService, ScanSelectionId, handler.OnScanSelection);
            handler.Register(commandService, ScanDocumentId, handler.OnScanDocument);
            handler.Register(commandService, RedactSelectionId, handler.OnRedactSelection);
            handler.Register(commandService, BrokerStatusId, handler.OnBrokerStatus);
            handler.Register(commandService, CheckEgressId, handler.OnCheckEgress);
        }

        private void Register(OleMenuCommandService service, int commandId, EventHandler invoke)
        {
            var id = new CommandID(CommandSet, commandId);
            service.AddCommand(new MenuCommand(invoke, id));
        }

        private BrokerClient CreateClient()
        {
            return new BrokerClient(_package.BrokerBaseUrl, () => BrokerToken.ReadFromFile());
        }

        // --- Command handlers ---------------------------------------------------

        private void OnScanSelection(object sender, EventArgs e)
        {
            _package.JoinableTaskFactory.RunAsync(async () =>
            {
                var text = await GetSelectedTextAsync().ConfigureAwait(true);
                if (string.IsNullOrEmpty(text))
                {
                    await ShowAsync("SoterAI: no selection to scan.").ConfigureAwait(true);
                    return;
                }

                await RunScanAsync(text).ConfigureAwait(true);
            });
        }

        private void OnScanDocument(object sender, EventArgs e)
        {
            _package.JoinableTaskFactory.RunAsync(async () =>
            {
                var text = await GetDocumentTextAsync().ConfigureAwait(true);
                if (string.IsNullOrEmpty(text))
                {
                    await ShowAsync("SoterAI: no active document to scan.").ConfigureAwait(true);
                    return;
                }

                await RunScanAsync(text).ConfigureAwait(true);
            });
        }

        private void OnRedactSelection(object sender, EventArgs e)
        {
            _package.JoinableTaskFactory.RunAsync(async () =>
            {
                await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
                var view = await GetActiveTextViewAsync().ConfigureAwait(true);
                var selection = view?.Selection;
                if (selection == null || selection.IsEmpty)
                {
                    await ShowAsync("SoterAI: no selection to redact.").ConfigureAwait(true);
                    return;
                }

                var span = selection.SelectedSpans[0];
                var original = span.GetText();

                try
                {
                    using var client = CreateClient();
                    // Broker performs the redaction; the adapter only substitutes text.
                    var redacted = await client.RedactAsync(original).ConfigureAwait(true);

                    await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
                    using (var edit = view.TextBuffer.CreateEdit())
                    {
                        edit.Replace(span.Span, redacted);
                        edit.Apply();
                    }

                    await ShowAsync("SoterAI: selection redacted locally.").ConfigureAwait(true);
                }
                catch (BrokerException ex)
                {
                    await ShowAsync("SoterAI: " + ex.Message).ConfigureAwait(true);
                }
            });
        }

        private void OnBrokerStatus(object sender, EventArgs e)
        {
            _package.JoinableTaskFactory.RunAsync(async () =>
            {
                try
                {
                    using var client = CreateClient();
                    var health = await client.GetHealthAsync().ConfigureAwait(true);
                    var safeMode = await client.GetSafeModeAsync().ConfigureAwait(true);
                    await ShowAsync(
                        $"SoterAI broker: {health?.Status ?? "unknown"} | Safe Mode: {safeMode?.Enabled}")
                        .ConfigureAwait(true);
                }
                catch (BrokerException ex)
                {
                    await ShowAsync("SoterAI: " + ex.Message).ConfigureAwait(true);
                }
            });
        }

        /// <summary>
        /// Pre-send egress check. Asks the broker whether the selection (or the
        /// active document) may be sent to a destination at all. Nothing is
        /// transmitted to that destination here.
        /// </summary>
        private void OnCheckEgress(object sender, EventArgs e)
        {
            _package.JoinableTaskFactory.RunAsync(async () =>
            {
                var text = await GetSelectedTextAsync().ConfigureAwait(true);
                if (string.IsNullOrEmpty(text))
                {
                    text = await GetDocumentTextAsync().ConfigureAwait(true);
                }

                if (string.IsNullOrWhiteSpace(text))
                {
                    await ShowAsync("SoterAI: nothing to check.").ConfigureAwait(true);
                    return;
                }

                var url = await PromptForUrlAsync().ConfigureAwait(true);
                if (string.IsNullOrWhiteSpace(url))
                {
                    return;
                }

                try
                {
                    using var client = CreateClient();
                    var decision = await client.CheckEgressAsync(url, text).ConfigureAwait(true);
                    await ShowAsync(decision.DisplayText()).ConfigureAwait(true);
                }
                catch (BrokerException ex)
                {
                    // A broker we cannot reach has not cleared anything. Say so.
                    await ShowAsync(
                        "SoterAI: " + ex.Message + Environment.NewLine +
                        "Treat this as NOT cleared to send.").ConfigureAwait(true);
                }
            });
        }

        /// <summary>Modal prompt for the destination URL. Returns null when cancelled.</summary>
        private async Task<string> PromptForUrlAsync()
        {
            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();

            var dialog = new Microsoft.VisualStudio.PlatformUI.DialogWindow
            {
                Title = "SoterAI: Check Egress",
                Width = 520,
                Height = 170,
                WindowStartupLocation = System.Windows.WindowStartupLocation.CenterOwner,
            };
            var stack = new System.Windows.Controls.StackPanel
            {
                Margin = new System.Windows.Thickness(12),
            };
            stack.Children.Add(new System.Windows.Controls.TextBlock
            {
                Text = "Destination URL the text would be sent to:",
                Margin = new System.Windows.Thickness(0, 0, 0, 6),
            });
            var box = new System.Windows.Controls.TextBox { Text = "https://" };
            stack.Children.Add(box);
            var ok = new System.Windows.Controls.Button
            {
                Content = "Check",
                Width = 90,
                Margin = new System.Windows.Thickness(0, 12, 0, 0),
                HorizontalAlignment = System.Windows.HorizontalAlignment.Right,
                IsDefault = true,
            };

            var entered = string.Empty;
            ok.Click += (_, __) =>
            {
                entered = box.Text;
                dialog.DialogResult = true;
                dialog.Close();
            };
            stack.Children.Add(ok);
            dialog.Content = stack;
            dialog.ShowModal();

            return string.IsNullOrWhiteSpace(entered) ? null : entered.Trim();
        }

        private async Task RunScanAsync(string content)
        {
            try
            {
                using var client = CreateClient();
                var result = await client.ScanAsync(content).ConfigureAwait(true);
                await ShowAsync(result.DisplayText()).ConfigureAwait(true);
            }
            catch (BrokerException ex)
            {
                await ShowAsync("SoterAI: " + ex.Message).ConfigureAwait(true);
            }
        }

        // --- Editor access ------------------------------------------------------

        private async Task<IWpfTextView> GetActiveTextViewAsync()
        {
            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();

            var textManager = await _package.GetServiceAsync(typeof(SVsTextManager)) as IVsTextManager;
            if (textManager == null)
            {
                return null;
            }

            textManager.GetActiveView(1, null, out IVsTextView vsTextView);
            if (vsTextView == null)
            {
                return null;
            }

            var componentModel = await _package.GetServiceAsync(typeof(SComponentModel)) as IComponentModel;
            var adapterFactory = componentModel?.GetService<IVsEditorAdaptersFactoryService>();
            return adapterFactory?.GetWpfTextView(vsTextView);
        }

        private async Task<string> GetSelectedTextAsync()
        {
            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
            var view = await GetActiveTextViewAsync().ConfigureAwait(true);
            var selection = view?.Selection;
            if (selection == null || selection.IsEmpty)
            {
                return string.Empty;
            }

            return selection.SelectedSpans[0].GetText();
        }

        private async Task<string> GetDocumentTextAsync()
        {
            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
            var view = await GetActiveTextViewAsync().ConfigureAwait(true);
            return view?.TextBuffer.CurrentSnapshot.GetText() ?? string.Empty;
        }

        private async Task ShowAsync(string message)
        {
            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
            VsShellUtilities.ShowMessageBox(
                _package,
                message,
                "SoterAI IDE Guard",
                OLEMSGICON.OLEMSGICON_INFO,
                OLEMSGBUTTON.OLEMSGBUTTON_OK,
                OLEMSGDEFBUTTON.OLEMSGDEFBUTTON_FIRST);
        }
    }
}
