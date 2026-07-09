package ai.soterai.guard.handlers;

import org.eclipse.core.commands.AbstractHandler;
import org.eclipse.core.commands.ExecutionEvent;
import org.eclipse.jface.text.BadLocationException;
import org.eclipse.jface.text.IDocument;
import org.eclipse.jface.text.ITextSelection;
import org.eclipse.ui.texteditor.ITextEditor;

import ai.soterai.guard.BrokerClient;
import ai.soterai.guard.views.SoterAIView;

/**
 * Replaces the current selection with a locally redacted version returned by
 * the broker's {@code /v1/redact} endpoint. PLANNED / UNBUILT.
 *
 * <p>Redaction is performed by the broker, not by this adapter. The replacement
 * is applied on the UI thread; the original selection text is never logged or
 * shown in the report view.</p>
 */
public class RedactSelectionHandler extends AbstractHandler {

    @Override
    public Object execute(ExecutionEvent event) {
        ITextEditor editor = HandlerSupport.textEditor(event);
        if (editor == null) {
            SoterAIView.report("Redact selection", "Open a text editor and select some text first.");
            return null;
        }
        ITextSelection selection = HandlerSupport.selection(editor);
        if (selection == null) {
            SoterAIView.report("Redact selection", "No text is selected.");
            return null;
        }
        IDocument document = HandlerSupport.document(editor);
        String content = selection.getText();
        int offset = selection.getOffset();
        int length = selection.getLength();

        HandlerSupport.runAsync("Redact selection",
                client -> redactAndApply(document, offset, length, content),
                result -> SoterAIView.report("Redact selection", result));
        return null;
    }

    private static String redactAndApply(IDocument document, int offset, int length, String content) {
        String redacted = new BrokerClient().redact(content);
        HandlerSupport.runOnUi(() -> {
            try {
                document.replace(offset, length, redacted);
            } catch (BadLocationException e) {
                SoterAIView.report("Redact selection",
                        "Selection moved before the redaction could be applied; nothing was changed.");
            }
        });
        return "Selection replaced with a locally redacted version.";
    }
}
