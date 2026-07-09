package ai.soterai.guard.handlers;

import org.eclipse.core.commands.AbstractHandler;
import org.eclipse.core.commands.ExecutionEvent;

import ai.soterai.guard.views.SoterAIView;

/**
 * Reports Local AI Broker health and Safe Mode state. PLANNED / UNBUILT.
 */
public class BrokerStatusHandler extends AbstractHandler {

    @Override
    public Object execute(ExecutionEvent event) {
        HandlerSupport.runAsync("Broker status",
                client -> {
                    boolean healthy = client.health();
                    if (!healthy) {
                        return "Local AI Broker is not reachable on the configured loopback port.";
                    }
                    boolean safeMode = client.safeModeEnabled();
                    return "Broker: healthy\nSafe Mode: " + (safeMode ? "enabled" : "disabled");
                },
                result -> SoterAIView.report("Broker status", result));
        return null;
    }
}
