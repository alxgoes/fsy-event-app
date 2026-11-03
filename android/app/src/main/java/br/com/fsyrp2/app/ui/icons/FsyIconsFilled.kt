package br.com.fsyrp2.app.ui.icons

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.addPathNodes
import androidx.compose.ui.unit.dp

/**
 * Estados "ativos" preenchidos derivados do mesmo contorno Lucide (ISC), para seleção
 * visível sem trocar de família de ícones (ex.: curtida marcada).
 */
object FsyIconsFilled {
    val Heart: ImageVector by lazy {
        ImageVector.Builder("HeartFilled", 24.dp, 24.dp, 24f, 24f).apply {
            addPath(
                pathData = addPathNodes(
                    "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
                ),
                fill = SolidColor(Color.Black),
                stroke = SolidColor(Color.Black),
                strokeLineWidth = 2f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round,
            )
        }.build()
    }
}
