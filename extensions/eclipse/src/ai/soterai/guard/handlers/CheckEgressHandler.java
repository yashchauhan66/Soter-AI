package ai.soterai.guard.handlers;

import org.eclipse.core.commands.AbstractHandler;
import org.eclipse.core.commands.ExecutionEvent;
import org.eclipse.jface.dialogs.IInputValidator;
import org.eclipse.jface.dialogs.InputDialog;
import org.eclipse.jface.text.ITextSelection;
import org.eclipse.jface.window.Window;
import org.eclipse.swt.widgets.Shell;
import org.eclipse.ui.handlers.HandlerUtil;
import org.eclipse.ui.texteditor.ITextEditor;

import ai.soterai.guard.views.SoterAIView;

/**
 * Pre-send egress check: asks the local broker whether the selection (or the
 * whole document) may be sent to a destination at all.
 *
 * <p>PLANNED / UNBUILT. This handler transmits nothing to the destination; it
 * only asks the broker. A broker failure is reported as a refusal, never as
 * clearance — "cannot ask" is not "allowed".</p>
 */
public class CheckEgressHandler extends AbstractHandler {

    @Override
    public Object execute(ExecutionEvent event) {
        ITextEditor editor = HandlerSupport.textEditor(event);
        if (editor == null) {
            SoterAIView.report("Check egress", "Open a text editor first.");
            return null;
        }
        ITextSelection selection = HandlerSupport.selection(editor);
        String content = selection != null
                ? selection.getText()
                : HandlerSupport.document(editor).get();
        if (content == null || content.isBlank()) {
            SoterAIView.report("Check egress", "Nothing to check: the selection and document are empty.");
            return null;
        }

        Shell shell = HandlerUtil.getActiveShell(event);
        InputDialog dialog = new InputDialog(
                shell,
                "SoterAI: Check Egress",
                "Destination URL the text would be sent to:",
                "https://",
                new UrlValidator());
        if (dialog.open() != Window.OK) {
            return null;
        }
        String url = dialog.getValue().trim();

        HandlerSupport.runAsync("Check egress",
                client -> client.checkEgress(url, content).display(),
                result -> SoterAIView.report("Check egress → " + url, result));
        return null;
    }

    /** Rejects empty input and anything that is not an http(s) URL. */
    private static final class UrlValidator implements IInputValidator {
        @Override
        public String isValid(String value) {
            if (value == null || value.isBlank()) {
                return "Enter the destination URL.";
            }
            String trimmed = value.trim();
            if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
                return "Enter a full http:// or https:// URL.";
            }
            if (trimmed.equals("https://") || trimmed.equals("http://")) {
                return "Enter a host after the scheme.";
            }
            return null;
        }
    }
}
