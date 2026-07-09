package ai.soterai.guard.handlers;

import org.eclipse.core.commands.AbstractHandler;
import org.eclipse.core.commands.ExecutionEvent;
import org.eclipse.jface.text.IDocument;
import org.eclipse.ui.texteditor.ITextEditor;

import ai.soterai.guard.views.SoterAIView;

/**
 * Scans the whole active document through the local broker.
 * PLANNED / UNBUILT.
 */
public class ScanFileHandler extends AbstractHandler {

    @Override
    public Object execute(ExecutionEvent event) {
        ITextEditor editor = HandlerSupport.textEditor(event);
        if (editor == null) {
            SoterAIView.report("Scan file", "Open a text editor first.");
            return null;
        }
        IDocument document = HandlerSupport.document(editor);
        if (document == null) {
            SoterAIView.report("Scan file", "The active editor has no readable document.");
            return null;
        }
        String content = document.get();
        HandlerSupport.runAsync("Scan file",
                client -> client.scan(content).display(),
                result -> SoterAIView.report("Scan file", result));
        return null;
    }
}
