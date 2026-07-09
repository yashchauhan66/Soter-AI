package ai.soterai.guard.views;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;

import org.eclipse.swt.SWT;
import org.eclipse.swt.layout.GridData;
import org.eclipse.swt.layout.GridLayout;
import org.eclipse.swt.widgets.Composite;
import org.eclipse.swt.widgets.Display;
import org.eclipse.swt.widgets.Label;
import org.eclipse.swt.widgets.Text;
import org.eclipse.ui.IWorkbenchPage;
import org.eclipse.ui.PartInitException;
import org.eclipse.ui.PlatformUI;
import org.eclipse.ui.part.ViewPart;

/**
 * Read-only report view for SoterAI IDE Guard.
 *
 * <p>PLANNED / UNBUILT. Displays only redacted, display-safe broker output
 * (decision, risk score, categories, content hash, redacted evidence preview).
 * Raw selections, file contents, prompts, and secrets are never appended here.</p>
 */
public class SoterAIView extends ViewPart {

    public static final String ID = "ai.soterai.guard.views.report";

    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm:ss");

    private Text output;

    @Override
    public void createPartControl(Composite parent) {
        GridLayout layout = new GridLayout(1, false);
        parent.setLayout(layout);

        Label header = new Label(parent, SWT.WRAP);
        header.setText("Local-first results from the authenticated loopback broker. "
                + "Only redacted findings appear here; nothing is uploaded to SoterAI Cloud by default.");
        header.setLayoutData(new GridData(SWT.FILL, SWT.TOP, true, false));

        output = new Text(parent, SWT.MULTI | SWT.READ_ONLY | SWT.WRAP | SWT.V_SCROLL | SWT.BORDER);
        output.setLayoutData(new GridData(SWT.FILL, SWT.FILL, true, true));
        output.setText("No scans yet.\n");
    }

    @Override
    public void setFocus() {
        if (output != null) {
            output.setFocus();
        }
    }

    /** Append one redacted report block. Safe to call from any thread. */
    public void append(String title, String body) {
        if (output == null || output.isDisposed()) {
            return;
        }
        String block = "[" + LocalTime.now().format(TIME) + "] " + title + "\n" + body + "\n\n";
        Display.getDefault().asyncExec(() -> {
            if (!output.isDisposed()) {
                if ("No scans yet.\n".equals(output.getText())) {
                    output.setText("");
                }
                output.append(block);
            }
        });
    }

    /** Reveal the view (creating it if necessary) and append a report. */
    public static void report(String title, String body) {
        Display.getDefault().asyncExec(() -> {
            try {
                IWorkbenchPage page = PlatformUI.getWorkbench()
                        .getActiveWorkbenchWindow().getActivePage();
                SoterAIView view = (SoterAIView) page.showView(ID);
                view.append(title, body);
            } catch (PartInitException | NullPointerException e) {
                // The workbench may not be ready; the notification path still informs the user.
            }
        });
    }
}
