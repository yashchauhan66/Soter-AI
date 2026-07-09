package ai.soterai.guard;

import org.eclipse.core.runtime.ILog;
import org.eclipse.core.runtime.Platform;
import org.eclipse.ui.plugin.AbstractUIPlugin;
import org.osgi.framework.BundleContext;

/**
 * Bundle activator for the SoterAI IDE Guard Eclipse adapter.
 *
 * <p>PLANNED / UNBUILT. This is a thin adapter: it forwards explicitly-selected
 * content to the authenticated loopback Local AI Broker. It does not implement
 * detection, redaction, or policy logic locally, and it does not transparently
 * intercept other AI assistants or terminal commands.</p>
 */
public class Activator extends AbstractUIPlugin {

    public static final String PLUGIN_ID = "ai.soterai.guard";

    private static Activator instance;

    @Override
    public void start(BundleContext context) throws Exception {
        super.start(context);
        instance = this;
    }

    @Override
    public void stop(BundleContext context) throws Exception {
        instance = null;
        super.stop(context);
    }

    public static Activator getDefault() {
        return instance;
    }

    public static ILog log() {
        return Platform.getLog(Activator.class);
    }
}
