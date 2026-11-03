package br.com.fsyrp2.app.ui.motion

import android.os.Build
import android.view.HapticFeedbackConstants
import android.view.View
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalView

/**
 * Retorno tátil padronizado. Usa apenas `View.performHapticFeedback` com constantes do
 * Android (sem APIs de fabricante), respeitando a configuração global do usuário: se a
 * vibração ao toque estiver desligada, o sistema não vibra. Constantes novas têm
 * substitutos para versões antigas (minSdk 26).
 */
@Stable
class FsyHaptics internal constructor(private val view: View) {

    private fun perform(constant: Int) {
        view.performHapticFeedback(constant)
    }

    /** Toque leve em um item selecionável (chip, aba, checkbox). */
    fun tick() = perform(HapticFeedbackConstants.CLOCK_TICK)

    /** Cartão levantado para arrastar. */
    fun grab() = perform(
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) HapticFeedbackConstants.GESTURE_START
        else HapticFeedbackConstants.LONG_PRESS
    )

    /** Cartão passou para outra posição durante o arraste. */
    fun step() = perform(
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) HapticFeedbackConstants.SEGMENT_FREQUENT_TICK
        else HapticFeedbackConstants.CLOCK_TICK
    )

    /** Cartão solto na nova posição. */
    fun drop() = perform(
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) HapticFeedbackConstants.GESTURE_END
        else HapticFeedbackConstants.VIRTUAL_KEY
    )

    /** Ação confirmada (presença marcada, aviso salvo). */
    fun confirm() = perform(
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) HapticFeedbackConstants.CONFIRM
        else HapticFeedbackConstants.VIRTUAL_KEY
    )

    /** Ação recusada (validação, sem conexão). */
    fun reject() = perform(
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) HapticFeedbackConstants.REJECT
        else HapticFeedbackConstants.LONG_PRESS
    )
}

@Composable
fun rememberFsyHaptics(): FsyHaptics {
    val view = LocalView.current
    return remember(view) { FsyHaptics(view) }
}
