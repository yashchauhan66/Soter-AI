package ai.soterai.guard.handlers;

import org.eclipse.core.commands.ExecutionEvent;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.core.runtime.IStatus;
import org.eclipse.core.runtime.Status;
import org.eclipse.core.runtime.jobs.Job;
import org.eclipse.jface.text.IDocument;
import org.eclipse.jface.text.ITextSelection;
import org.eclipse.jface.viewers.ISelection;
import org.eclipse.swt.widgets.Display;
import org.eclipse.ui.IEditorPart;
import org.eclipse.ui.handlers.HandlerUtil;
import org.eclipse.ui.texteditor.ITextEditor;

import ai.soterai.guard.Activator;
import ai.soterai.guard.BrokerClient;
import ai.soterai.guard.views.SoterAIView;

/**
 * Shared helpers for the command handlers.
 *
 * <p>PLANNED / UNBUILT. Keeps broker I/O off the UI thread and routes results
 * to the report view / status line. No content classification happens here.</p>
 */
final class HandlerSupport {

    private HandlerSupport() {
    }

    static ITextEditor textEditor(ExecutionEvent event) {
        IEditorPart editor = HandlerUtil.getActiveEditor(event);
        if (editor instanceof ITextEditor textEditor) {
            return textEditor;
        }
        return null;
    }

    static IDocument document(ITextEditor editor) {
        return editor.getDocumentProvider().getDocument(editor.getEditorInput());
    }

    static ITextSelection selection(ITextEditor editor) {
        ISelection selection = editor.getSelectionProvider().getSelection();
        if (selection instanceof ITextSelection textSelection && textSelection.getLength() > 0) {
            return textSelection;
        }
        return null;
    }

    /** Run a broker call in a background Job; deliver its report on completion. */
    static void runAsync(String jobName, BrokerCall call, Report onSuccess) {
        Job job = new Job(jobName) {
            @Override
            protected IStatus run(IProgressMonitor monitor) {
                try {
                    onSuccess.deliver(call.execute(new BrokerClient()));
                    return Status.OK_STATUS;
                } catch (BrokerClient.BrokerException e) {
                    // Message is broker-authored and display-safe (never contains scanned content).
                    SoterAIView.report(jobName + " — error", e.getMessage());
                    return Status.OK_STATUS;
                } catch (RuntimeException e) {
                    Activator.log().error("SoterAI broker call failed", e);
                    return new Status(IStatus.ERROR, Activator.PLUGIN_ID, "SoterAI broker call failed");
                }
            }
        };
        job.setUser(true);
        job.schedule();
    }

    static void runOnUi(Runnable runnable) {
        Display.getDefault().asyncExec(runnable);
    }

    @FunctionalInterface
    interface BrokerCall {
        String execute(BrokerClient client);
    }

    @FunctionalInterface
    interface Report {
        void deliver(String result);
    }
}
