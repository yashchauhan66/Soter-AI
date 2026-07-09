package ai.soterai.guard.ui

import ai.soterai.guard.settings.BrokerSettings
import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.CustomStatusBarWidget
import com.intellij.openapi.wm.StatusBar
import com.intellij.openapi.wm.StatusBarWidget
import com.intellij.openapi.wm.StatusBarWidgetFactory
import com.intellij.ui.components.JBLabel
import javax.swing.JComponent

class SoterAIStatusWidgetFactory : StatusBarWidgetFactory {
    override fun getId(): String = "SoterAIStatus"
    override fun getDisplayName(): String = "SoterAI Guard"
    override fun isAvailable(project: Project): Boolean = true
    override fun createWidget(project: Project): StatusBarWidget = SoterAIStatusWidget()
    override fun disposeWidget(widget: StatusBarWidget) = widget.dispose()
    override fun canBeEnabledOn(statusBar: StatusBar): Boolean = true
}

private class SoterAIStatusWidget : CustomStatusBarWidget {
    private val label = JBLabel()
    override fun ID(): String = "SoterAIStatus"
    override fun getComponent(): JComponent {
        val enabled = service<BrokerSettings>().safeModeEnabled
        label.text = "SoterAI: ${if (enabled) "Safe" else "Ready"}"
        label.toolTipText = "SoterAI IDE Guard — authenticated local broker"
        return label
    }
    override fun install(statusBar: StatusBar) = Unit
    override fun dispose() = Unit
}

