// SoterAIGuardPackage.cs
//
// AsyncPackage entry point for the SoterAI IDE Guard Visual Studio adapter.
//
// STATUS: PLANNED / UNBUILT. Idiomatic against the classic in-process VS SDK
// (Microsoft.VisualStudio.SDK). NOT compiled in this environment. See
// docs/visual-studio-extension-plan.md for the SDK-surface decision and
// docs/visual-studio-test-report.md for the acceptance gate.

using System;
using System.Runtime.InteropServices;
using System.Threading;
using Microsoft.VisualStudio.Shell;
using Task = System.Threading.Tasks.Task;

namespace SoterAI.Guard
{
    /// <summary>
    /// Registers the SoterAI Guard package, its commands, and its tool window.
    /// Loads asynchronously and adds no functionality beyond wiring the broker
    /// client to menu commands -- all security logic stays in the broker.
    /// </summary>
    [PackageRegistration(UseManagedResourcesOnly = true, AllowsBackgroundLoading = true)]
    [Guid(PackageGuidString)]
    [ProvideMenuResource("Menus.ctmenu", 1)]
    [ProvideToolWindow(typeof(ToolWindows.SoterAIToolWindow))]
    // Load in the background when a solution exists so the status/ledger view can
    // populate without blocking the shell.
    [ProvideAutoLoad(Microsoft.VisualStudio.VSConstants.UICONTEXT.SolutionExists_string,
        PackageAutoLoadFlags.BackgroundLoad)]
    public sealed class SoterAIGuardPackage : AsyncPackage
    {
        public const string PackageGuidString = "b2f6c3d4-9a11-4e2c-8d7a-0f3a1c6b9e21";

        /// <summary>Broker base URL. TODO: surface via an options page (see plan).</summary>
        public string BrokerBaseUrl { get; private set; } = "http://127.0.0.1:47321";

        protected override async Task InitializeAsync(
            CancellationToken cancellationToken,
            IProgress<ServiceProgressData> progress)
        {
            // Switch to the UI thread before touching command services.
            await JoinableTaskFactory.SwitchToMainThreadAsync(cancellationToken);

            await Commands.GuardCommands.InitializeAsync(this).ConfigureAwait(true);
        }
    }
}
