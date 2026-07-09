package ai.soterai.guard.settings

import com.intellij.credentialStore.CredentialAttributes
import com.intellij.ide.passwordSafe.PasswordSafe
import com.intellij.openapi.components.Service

@Service(Service.Level.APP)
class BrokerSettings {
    @Volatile
    var port: Int = DEFAULT_PORT

    @Volatile
    var safeModeEnabled: Boolean = false

    fun brokerUrl(): String = "http://127.0.0.1:$port"

    fun token(): String = PasswordSafe.instance.getPassword(TOKEN_ATTRIBUTES).orEmpty()

    fun saveToken(token: String) {
        PasswordSafe.instance.setPassword(TOKEN_ATTRIBUTES, token.trim().ifEmpty { null })
    }

    companion object {
        const val DEFAULT_PORT = 47321
        private val TOKEN_ATTRIBUTES = CredentialAttributes("SoterAI.LocalBroker.Token")
    }
}

