import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import {
  ICommandPalette,
  InputDialog,
  Notification,
  MainAreaWidget
} from '@jupyterlab/apputils';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { Cell, CodeCell } from '@jupyterlab/cells';
import { ISettingRegistry } from '@jupyterlab/settingregistry';

import {
  BrokerClient,
  BrokerError,
  LocalLoopbackTransport,
  ServerProxyTransport,
  ScanResult
} from './broker';
import { ReportPanel } from './report';

/**
 * SoterAI IDE Guard for JupyterLab.
 *
 * PLANNED / UNBUILT scaffold. Thin adapter only: it routes explicitly selected
 * cells / notebooks / prompts to the authenticated loopback Local AI Broker and
 * shows redacted results. It reimplements no detector. See the docs in
 * `docs/` for the honest status and the manual build/install/canary procedure.
 *
 * NOTE: exact @jupyterlab 4.x API signatures (shared cell model getters,
 * output-area events) must be verified against the installed version when this
 * is actually built. They are used here per the 4.2 docs but are UNVERIFIED.
 */

const PLUGIN_ID = '@soterai/jupyterlab-guard:plugin';

namespace CommandIDs {
  export const scanCell = 'soterai:scan-cell';
  export const scanSelectedCells = 'soterai:scan-selected-cells';
  export const redactCell = 'soterai:redact-cell';
  export const scanNotebookForSecrets = 'soterai:scan-notebook-secrets';
  export const safePrompt = 'soterai:safe-prompt';
  export const toggleOutputMonitor = 'soterai:toggle-output-monitor';
  export const openReport = 'soterai:open-report';
}

const CATEGORY = 'SoterAI IDE Guard';

const plugin: JupyterFrontEndPlugin<void> = {
  id: PLUGIN_ID,
  autoStart: true,
  requires: [INotebookTracker],
  optional: [ICommandPalette, ISettingRegistry],
  activate: (
    app: JupyterFrontEnd,
    notebooks: INotebookTracker,
    palette: ICommandPalette | null,
    settings: ISettingRegistry | null
  ): void => {
    const { commands, shell } = app;

    // Transport selection. Default to the same-host server-extension proxy so
    // the broker token never enters the browser; fall back to loopback only
    // when the user opts in (desktop, same machine).
    let useServerProxy = true;
    let brokerPort = 47321;
    const pastedToken: string | null = null;
    let outputMonitorEnabled = false;

    if (settings) {
      void settings
        .load(PLUGIN_ID)
        .then(s => {
          const read = () => {
            useServerProxy = s.get('useServerProxy').composite as boolean;
            brokerPort = (s.get('brokerPort').composite as number) || 47321;
            outputMonitorEnabled = s.get('outputMonitor').composite as boolean;
          };
          read();
          s.changed.connect(read);
        })
        .catch(() => {
          /* settings schema absent in dev; defaults apply */
        });
    }

    const transport = new (class {
      private local = new LocalLoopbackTransport(
        () => brokerPort,
        async () => pastedToken
      );
      private proxy = new ServerProxyTransport();
      baseUrl(): string {
        return (useServerProxy ? this.proxy : this.local).baseUrl();
      }
      authorization(): Promise<string | null> {
        return (useServerProxy ? this.proxy : this.local).authorization();
      }
    })();

    const broker = new BrokerClient(transport);

    // --- Report panel -------------------------------------------------------
    let report: ReportPanel | null = null;
    const ensureReport = (): ReportPanel => {
      if (!report || report.isDisposed) {
        report = new ReportPanel();
        const widget = new MainAreaWidget({ content: report });
        widget.id = 'soterai-guard-report-main';
        widget.title.label = 'SoterAI Guard';
        widget.title.closable = true;
        shell.add(widget, 'right', { rank: 900 });
        report.disposed.connect(() => {
          report = null;
        });
      }
      shell.activateById('soterai-guard-report-main');
      return report;
    };

    // --- Helpers ------------------------------------------------------------
    const activeCell = (): Cell | null =>
      notebooks.currentWidget?.content.activeCell ?? null;

    /** Cell source text via the shared model (JLab 4). */
    const cellSource = (cell: Cell): string => cell.model.sharedModel.getSource();

    const runScan = async (
      title: string,
      content: string
    ): Promise<void> => {
      if (!content.trim()) {
        ensureReport().reportNotice(title, 'Nothing to scan (empty content).');
        return;
      }
      try {
        const result: ScanResult = await broker.scan(content);
        ensureReport().reportScan(title, result);
        announce(result);
      } catch (err) {
        handleError(title, err);
      }
    };

    const announce = (result: ScanResult): void => {
      if (result.decision === 'block') {
        Notification.error(`SoterAI blocked content (risk ${result.riskScore}).`, {
          autoClose: 6000
        });
      } else if (result.decision !== 'allow') {
        Notification.warning(
          `SoterAI: ${result.decision} (risk ${result.riskScore}).`,
          { autoClose: 5000 }
        );
      }
    };

    const handleError = (title: string, err: unknown): void => {
      const message =
        err instanceof BrokerError
          ? err.message
          : 'SoterAI broker request failed.';
      ensureReport().reportNotice(`${title} — error`, message);
      Notification.error(message, { autoClose: 6000 });
    };

    // --- Commands -----------------------------------------------------------
    commands.addCommand(CommandIDs.scanCell, {
      label: 'Scan Active Cell with SoterAI',
      isEnabled: () => activeCell() !== null,
      execute: async () => {
        const cell = activeCell();
        if (!cell) {
          return;
        }
        await runScan('Scan active cell', cellSource(cell));
      }
    });

    commands.addCommand(CommandIDs.scanSelectedCells, {
      label: 'Scan Selected Cells with SoterAI',
      isEnabled: () => notebooks.currentWidget !== null,
      execute: async () => {
        const panel = notebooks.currentWidget;
        if (!panel) {
          return;
        }
        const notebook = panel.content;
        const selected = notebook.widgets.filter(c =>
          notebook.isSelectedOrActive(c)
        );
        const combined = selected.map(cellSource).join('\n\n');
        await runScan(`Scan ${selected.length} selected cell(s)`, combined);
      }
    });

    commands.addCommand(CommandIDs.redactCell, {
      label: 'Redact Active Cell for AI (SoterAI)',
      isEnabled: () => activeCell() !== null,
      execute: async () => {
        const cell = activeCell();
        if (!cell) {
          return;
        }
        const source = cellSource(cell);
        if (!source.trim()) {
          return;
        }
        try {
          const { redacted } = await broker.redact(source);
          // Redaction is produced by the broker, not this adapter.
          cell.model.sharedModel.setSource(redacted);
          ensureReport().reportNotice(
            'Redact active cell',
            'Cell source replaced with a locally redacted version.'
          );
        } catch (err) {
          handleError('Redact active cell', err);
        }
      }
    });

    commands.addCommand(CommandIDs.scanNotebookForSecrets, {
      label: 'Scan Notebook for Secrets (SoterAI)',
      isEnabled: () => notebooks.currentWidget !== null,
      execute: async () => {
        const panel = notebooks.currentWidget;
        if (!panel) {
          return;
        }
        const combined = panel.content.widgets.map(cellSource).join('\n\n');
        await runScan('Scan notebook for secrets', combined);
      }
    });

    commands.addCommand(CommandIDs.safePrompt, {
      label: 'Safe Prompt Check (SoterAI)',
      execute: async () => {
        const input = await InputDialog.getText({
          title: 'SoterAI safe prompt check',
          label: 'Prompt to check before sending to an AI assistant:'
        });
        if (!input.button.accept || !input.value) {
          return;
        }
        try {
          const result = await broker.scanMessages([
            { role: 'user', content: input.value }
          ]);
          ensureReport().reportScan('Safe prompt check', result);
          announce(result);
        } catch (err) {
          handleError('Safe prompt check', err);
        }
      }
    });

    commands.addCommand(CommandIDs.toggleOutputMonitor, {
      label: 'Toggle SoterAI Output-Leak Monitor',
      isToggled: () => outputMonitorEnabled,
      execute: async () => {
        outputMonitorEnabled = !outputMonitorEnabled;
        if (settings) {
          try {
            const s = await settings.load(PLUGIN_ID);
            await s.set('outputMonitor', outputMonitorEnabled);
          } catch {
            /* schema absent; in-memory toggle only */
          }
        }
        ensureReport().reportNotice(
          'Output-leak monitor',
          outputMonitorEnabled
            ? 'Enabled. New cell outputs will be scanned by the broker; only redacted findings appear here.'
            : 'Disabled.'
        );
      }
    });

    commands.addCommand(CommandIDs.openReport, {
      label: 'Open SoterAI Guard Report',
      execute: () => {
        ensureReport();
      }
    });

    // --- Output-leak monitor -----------------------------------------------
    // Watches code-cell output areas on the current notebook. When enabled, it
    // sends output TEXT to the broker's /v1/scan and reports ONLY the redacted
    // result. Raw output text is never placed in the report panel.
    const wireOutputMonitor = (panel: NotebookPanel | null): void => {
      if (!panel) {
        return;
      }
      panel.content.widgets.forEach(cell => {
        if (!(cell instanceof CodeCell)) {
          return;
        }
        const outputs = cell.model.outputs;
        outputs.changed.connect(async () => {
          if (!outputMonitorEnabled) {
            return;
          }
          const text = extractOutputText(cell);
          if (!text.trim()) {
            return;
          }
          try {
            const result = await broker.scan(text);
            if (result.decision !== 'allow') {
              ensureReport().reportScan('Output-leak monitor', result);
              announce(result);
            }
          } catch (err) {
            handleError('Output-leak monitor', err);
          }
        });
      });
    };

    notebooks.currentChanged.connect((_, panel) => wireOutputMonitor(panel));
    wireOutputMonitor(notebooks.currentWidget);

    // --- Palette ------------------------------------------------------------
    if (palette) {
      [
        CommandIDs.scanCell,
        CommandIDs.scanSelectedCells,
        CommandIDs.redactCell,
        CommandIDs.scanNotebookForSecrets,
        CommandIDs.safePrompt,
        CommandIDs.toggleOutputMonitor,
        CommandIDs.openReport
      ].forEach(command => palette.addItem({ command, category: CATEGORY }));
    }

    // Silence unused-var lints for optional flows kept for the real build.
    void ServerProxyTransport;
  }
};

/** Concatenate text/plain and stream text from a code cell's outputs. */
function extractOutputText(cell: CodeCell): string {
  const outputs = cell.model.outputs;
  const parts: string[] = [];
  for (let i = 0; i < outputs.length; i++) {
    const output = outputs.get(i).toJSON() as {
      text?: string | string[];
      data?: Record<string, unknown>;
    };
    if (typeof output.text === 'string') {
      parts.push(output.text);
    } else if (Array.isArray(output.text)) {
      parts.push(output.text.join(''));
    }
    const plain = output.data?.['text/plain'];
    if (typeof plain === 'string') {
      parts.push(plain);
    } else if (Array.isArray(plain)) {
      parts.push((plain as string[]).join(''));
    }
  }
  return parts.join('\n');
}

export default plugin;
