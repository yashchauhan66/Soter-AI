package ai.soterai.guard

import java.nio.file.Files
import java.nio.file.Path
import kotlin.io.path.readText
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class BrokerContractTest {
    private val sourceRoot: Path = Path.of("src", "main", "kotlin")

    @Test
    fun `broker is fixed to loopback and requires bearer auth`() {
        val source = sourceRoot.resolve("ai/soterai/guard/broker/BrokerClient.kt").readText()
        val settings = sourceRoot.resolve("ai/soterai/guard/settings/BrokerSettings.kt").readText()
        assertTrue(settings.contains("http://127.0.0.1"))
        assertTrue(source.contains("Authorization"))
        assertTrue(source.contains("Bearer"))
        assertFalse(source.contains("0.0.0.0"))
    }

    @Test
    fun `token uses Password Safe and is not logged`() {
        val settings = sourceRoot.resolve("ai/soterai/guard/settings/BrokerSettings.kt").readText()
        assertTrue(settings.contains("PasswordSafe.instance"))
        Files.walk(sourceRoot).use { files ->
            val combined = files.filter { Files.isRegularFile(it) }.map { it.readText() }.toList().joinToString("\n")
            assertFalse(combined.contains("println(token"))
            assertFalse(combined.contains("logger.info(token"))
        }
    }
}

