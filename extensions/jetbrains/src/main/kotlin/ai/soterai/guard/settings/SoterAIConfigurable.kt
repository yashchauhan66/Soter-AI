package ai.soterai.guard.settings

import com.intellij.openapi.components.service
import com.intellij.openapi.options.Configurable
import com.intellij.ui.components.JBLabel
import com.intellij.ui.components.JBPasswordField
import com.intellij.ui.components.JBTextField
import com.intellij.util.ui.FormBuilder
import javax.swing.JComponent
import javax.swing.JPanel

class SoterAIConfigurable : Configurable {
    private val settings = service<BrokerSettings>()
    private var panel: JPanel? = null
    private val portField = JBTextField()
    private val tokenField = JBPasswordField()

    override fun getDisplayName(): String = "SoterAI IDE Guard"

    override fun createComponent(): JComponent {
        portField.text = settings.port.toString()
        tokenField.text = settings.token()
        panel = FormBuilder.createFormBuilder()
            .addLabeledComponent(JBLabel("Loopback broker port:"), portField, 1, false)
            .addLabeledComponent(JBLabel("Broker token (Password Safe):"), tokenField, 1, false)
            .addComponentFillVertically(JPanel(), 0)
            .panel
        return panel!!
    }

    override fun isModified(): Boolean =
        portField.text.toIntOrNull() != settings.port || String(tokenField.password) != settings.token()

    override fun apply() {
        val newPort = portField.text.toIntOrNull()
            ?: throw com.intellij.openapi.options.ConfigurationException("Port must be a number")
        if (newPort !in 1024..65535) {
            throw com.intellij.openapi.options.ConfigurationException("Port must be between 1024 and 65535")
        }
        settings.port = newPort
        settings.saveToken(String(tokenField.password))
    }

    override fun reset() {
        portField.text = settings.port.toString()
        tokenField.text = settings.token()
    }

    override fun disposeUIResources() {
        tokenField.text = ""
        panel = null
    }
}

