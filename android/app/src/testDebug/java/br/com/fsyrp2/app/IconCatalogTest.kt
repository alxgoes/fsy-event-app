package br.com.fsyrp2.app

import androidx.compose.ui.graphics.vector.ImageVector
import br.com.fsyrp2.app.ui.icons.FsyIcons
import org.junit.Assert.assertTrue
import org.junit.Test

/** A valid compile cannot detect malformed SVG data stored in lazy icon properties. */
class IconCatalogTest {
    @Test fun everyIconCanBeConstructedBeforeAnyScreenUsesIt() {
        val getters = FsyIcons::class.java.declaredMethods.filter {
            it.name.startsWith("get") && it.parameterCount == 0 &&
                it.returnType == ImageVector::class.java && java.lang.reflect.Modifier.isPublic(it.modifiers)
        }
        assertTrue("O catálogo de ícones deve estar disponível", getters.isNotEmpty())
        val invalid = getters.mapNotNull { getter ->
            runCatching { getter.invoke(FsyIcons) }.exceptionOrNull()?.let {
                "${getter.name}: ${it.cause?.message ?: it.message}"
            }
        }
        assertTrue("Ícones com dados vetoriais inválidos: ${invalid.joinToString()}", invalid.isEmpty())
    }
}
