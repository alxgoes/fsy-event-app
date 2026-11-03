package br.com.fsyrp2.app.ui.theme

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.view.View
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

/** Aparência escolhida pela pessoa. Padrão: acompanha o celular. */
enum class FsyThemeMode(val key: String, val label: String) {
    SYSTEM("system", "Automático"),
    LIGHT("light", "Claro"),
    DARK("dark", "Escuro");

    companion object {
        fun fromKey(key: String?): FsyThemeMode = entries.firstOrNull { it.key == key } ?: SYSTEM
    }
}

/**
 * Preferência de aparência global (vale também para a tela de entrada).
 * Guardada em SharedPreferences próprias ("fsy_appearance"): não é dado de sessão nem segredo,
 * por isso não fica no cofre de sessão e sobrevive ao sair da conta.
 */
object FsyAppearance {
    private const val PREFS = "fsy_appearance"
    private const val KEY_MODE = "theme_mode"

    var mode by mutableStateOf(FsyThemeMode.SYSTEM)
        private set

    private var loaded = false

    fun ensureLoaded(context: Context) {
        if (loaded) return
        loaded = true
        mode = FsyThemeMode.fromKey(
            context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_MODE, null)
        )
    }

    fun update(context: Context, newMode: FsyThemeMode) {
        mode = newMode
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_MODE, newMode.key)
            .apply()
    }
}

/** Tema escuro efetivo: Automático segue o celular (e reage à mudança), Claro/Escuro fixam. */
@Composable
fun fsyEffectiveDarkTheme(): Boolean {
    FsyAppearance.ensureLoaded(LocalContext.current)
    val system = isSystemInDarkTheme()
    return when (FsyAppearance.mode) {
        FsyThemeMode.SYSTEM -> system
        FsyThemeMode.LIGHT -> false
        FsyThemeMode.DARK -> true
    }
}

/**
 * Ícones das barras de status/navegação acompanham o tema EFETIVO do app (não só o do celular):
 * escuro manual com celular claro não deixa ícones escuros sobre fundo escuro.
 */
@Composable
internal fun FsySystemBarsEffect(darkTheme: Boolean) {
    val view = LocalView.current
    if (view.isInEditMode) return
    SideEffect {
        val window = view.findActivity()?.window ?: return@SideEffect
        WindowCompat.getInsetsController(window, view).apply {
            isAppearanceLightStatusBars = !darkTheme
            isAppearanceLightNavigationBars = !darkTheme
        }
    }
}

private fun View.findActivity(): Activity? {
    var ctx: Context? = context
    while (ctx is ContextWrapper) {
        if (ctx is Activity) return ctx
        ctx = ctx.baseContext
    }
    return null
}
