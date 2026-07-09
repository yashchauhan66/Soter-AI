package ai.soterai.guard.handlers;

import org.eclipse.core.commands.AbstractHandler;
import org.eclipse.core.commands.ExecutionEvent;
import org.eclipse.jface.text.ITextSelection;
import org.eclipse.ui.texteditor.ITextEditor;

import ai.soterai.guard.views.SoterAIView;

/**
 * Scans the current editor selection through the local broker.
 * PLANNED / UNBUILT.
 */
public class ScanSelectionHandler extends AbstractHandler {

    @Override
    public Object execute(ExecutionEvent event) {
        ITextEditor editor = HandlerSupport.textEditor(event);
        if (editor == null) {
            SoterAIView.report("Scan selection", "Open a text editor and select some text first.");
            return null;
        }
        ITextSelection selection = HandlerSupport.selection(editor);
        if (selection == null) {
            SoterAIView.report("Scan selection", "No text is selected.");
            return null;
        }
        String content = selection.getText();
        HandlerSupport.runAsync("Scan selection",
                client -> client.scan(content).display(),
                result -> SoterAIView.report("Scan selection", result));
        return null;
    }
}
