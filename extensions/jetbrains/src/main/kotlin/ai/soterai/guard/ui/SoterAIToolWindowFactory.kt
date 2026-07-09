package ai.soterai.guard.ui

import ai.soterai.guard.broker.BrokerClient
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.components.JBScrollPane
import com.intellij.ui.components.JBTextArea
import com.intellij.ui.content.ContentFactory
import java.awt.BorderLayout
import java.awt.FlowLayout
import javax.swing.JButton
import javax.swing.JPanel

class SoterAIToolWindowFactory : ToolWindowFactory {
    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        val output = JBTextArea("SoterAI Local AI Broker status has not been checked.").apply {
            isEditable = false
            lineWrap = true
            wrapStyleWord = true
        }
        val status = JButton("Check Broker")
        val memory = JButton("Memory / Ledger")
        status.addActionListener { load(output) { BrokerClient().health() } }
        memory.addActionListener { load(output) { BrokerClient().recentEvents() } }
        val buttons = JPanel(FlowLayout(FlowLayout.LEFT)).apply {
            add(status)
            add(memory)
        }
        val panel = JPanel(BorderLayout()).apply {
            add(buttons, BorderLayout.NORTH)
            add(JBScrollPane(output), BorderLayout.CENTER)
        }
        val content = ContentFactory.getInstance().createContent(panel, "Overview", false)
        toolWindow.contentManager.addContent(content)
    }

    private fun load(output: JBTextArea, request: () -> String) {
        output.text = "Loading redacted broker data…"
        ApplicationManager.getApplication().executeOnPooledThread {
            val result = try { request() } catch (error: Exception) { error.message ?: "Broker request failed" }
            ApplicationManager.getApplication().invokeLater { output.text = result }
        }
    }
}

