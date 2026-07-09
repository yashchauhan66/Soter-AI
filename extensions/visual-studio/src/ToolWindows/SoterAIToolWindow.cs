// SoterAIToolWindow.cs
//
// Tool window skeleton that hosts the SoterAI status / "What AI Saw" ledger view.
// It shows only redacted findings returned by the broker; raw source, prompts,
// secrets, and terminal output are never rendered here or sent to the cloud.
//
// STATUS: PLANNED / UNBUILT. NOT compiled in this environment.

using System;
using System.Runtime.InteropServices;
using Microsoft.VisualStudio.Shell;

namespace SoterAI.Guard.ToolWindows
{
    /// <summary>
    /// Docking tool window for broker status and the redacted event ledger.
    /// </summary>
    [Guid(WindowGuidString)]
    public sealed class SoterAIToolWindow : ToolWindowPane
    {
        public const string WindowGuidString = "d41a2e57-6b3c-4f18-9a2d-5c7e0b4a1f36";

        public SoterAIToolWindow() : base(null)
        {
            Caption = "SoterAI IDE Guard";

            // The control is a WPF UserControl (SoterAIToolWindowControl) that binds
            // to redacted broker data only. Instantiated here rather than in a .xaml
            // designer partial so the scaffold stays self-contained.
            Content = new SoterAIToolWindowControl();
        }
    }

    /// <summary>
    /// Placeholder view model / control. The real implementation binds a list of
    /// redacted ledger entries from GET /v1/events/recent and a status header from
    /// GET /health + GET /v1/safe-mode/status.
    /// </summary>
    public sealed class SoterAIToolWindowControl : System.Windows.Controls.UserControl
    {
        public SoterAIToolWindowControl()
        {
            // TODO: replace with a bound ItemsControl of redacted ledger entries.
            Content = new System.Windows.Controls.TextBlock
            {
                Margin = new System.Windows.Thickness(12),
                TextWrapping = System.Windows.TextWrapping.Wrap,
                Text = "SoterAI IDE Guard\n\n" +
                       "This panel will show broker status and the redacted \"What AI Saw\" " +
                       "ledger. Raw source, prompts, and secrets are never displayed here " +
                       "or uploaded by default.",
            };
        }
    }
}
