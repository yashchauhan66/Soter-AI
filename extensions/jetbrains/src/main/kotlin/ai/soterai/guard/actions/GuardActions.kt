package ai.soterai.guard.actions

import ai.soterai.guard.broker.BrokerClient
import ai.soterai.guard.settings.BrokerSettings
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.command.WriteCommandAction
import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project

private fun notify(project: Project?, message: String, type: NotificationType = NotificationType.INFORMATION) {
    NotificationGroupManager.getInstance().getNotificationGroup("SoterAI Guard")
        .createNotification(message, type).notify(project)
}

private fun runBroker(project: Project?, operation: () -> String) {
    ApplicationManager.getApplication().executeOnPooledThread {
        try {
            val message = operation()
            ApplicationManager.getApplication().invokeLater { notify(project, message) }
        } catch (error: Exception) {
            val safeMessage = error.message ?: "Local broker request failed"
            ApplicationManager.getApplication().invokeLater { notify(project, safeMessage, NotificationType.ERROR) }
        }
    }
}

class ScanSelectionAction : AnAction() {
    override fun update(e: AnActionEvent) {
        e.presentation.isEnabled = e.getData(CommonDataKeys.EDITOR)?.selectionModel?.hasSelection() == true
    }

    override fun actionPerformed(e: AnActionEvent) {
        val content = e.getRequiredData(CommonDataKeys.EDITOR).selectionModel.selectedText ?: return
        runBroker(e.project) { BrokerClient().scan(content).displayText() }
    }
}

class ScanCurrentFileAction : AnAction() {
    override fun update(e: AnActionEvent) {
        e.presentation.isEnabled = e.getData(CommonDataKeys.EDITOR) != null
    }

    override fun actionPerformed(e: AnActionEvent) {
        val content = e.getRequiredData(CommonDataKeys.EDITOR).document.text
        runBroker(e.project) { BrokerClient().scan(content).displayText() }
    }
}

class RedactSelectionAction : AnAction() {
    override fun update(e: AnActionEvent) {
        e.presentation.isEnabled = e.getData(CommonDataKeys.EDITOR)?.selectionModel?.hasSelection() == true
    }

    override fun actionPerformed(e: AnActionEvent) {
        val editor = e.getRequiredData(CommonDataKeys.EDITOR)
        val selection = editor.selectionModel
        val content = selection.selectedText ?: return
        val start = selection.selectionStart
        val end = selection.selectionEnd
        ApplicationManager.getApplication().executeOnPooledThread {
            try {
                val redacted = BrokerClient().redact(content)
                ApplicationManager.getApplication().invokeLater {
                    WriteCommandAction.runWriteCommandAction(e.project) {
                        editor.document.replaceString(start, end, redacted)
                    }
                    notify(e.project, "Selection redacted locally by SoterAI")
                }
            } catch (error: Exception) {
                ApplicationManager.getApplication().invokeLater {
                    notify(e.project, error.message ?: "Redaction failed", NotificationType.ERROR)
                }
            }
        }
    }
}

class ToggleSafeModeAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val settings = service<BrokerSettings>()
        runBroker(e.project) {
            val enabled = BrokerClient().setSafeMode(!BrokerClient().safeModeStatus())
            settings.safeModeEnabled = enabled
            "SoterAI Safe Mode ${if (enabled) "enabled" else "disabled"}"
        }
    }
}

