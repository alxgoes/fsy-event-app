package br.com.fsyrp2.app.ui.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.fsyrp2.app.R
import br.com.fsyrp2.app.ui.theme.FsyCoral
import br.com.fsyrp2.app.ui.theme.FsyGraphite
import br.com.fsyrp2.app.ui.theme.FsyAzul
import br.com.fsyrp2.app.ui.theme.FsySunshine
import br.com.fsyrp2.app.ui.theme.LibreBaskervilleFontFamily

/** Fatos oficiais do evento — exibidos, nunca reescritos. */
object FsyEventFacts {
    const val SESSION = "Sessão Ribeirão Preto 2"
    const val THEME_LEAD = "Alegrar-se em"
    const val THEME_FOCUS = "Cristo"
    const val THEME = "$THEME_LEAD $THEME_FOCUS"
    const val SCRIPTURE = "Filipenses 4:4"
    const val DATES = "06 a 10 de fevereiro de 2027"
    const val DATES_SHORT = "06–10 fev 2027"
    const val VENUE = "Ipê Park Hotel"
    const val CITY = "São José do Rio Preto, SP"
}

/** Forma de arco do templo: topo em semicírculo, base levemente arredondada. */
val FsyArchShape = RoundedCornerShape(topStartPercent = 50, topEndPercent = 50, bottomStartPercent = 8, bottomEndPercent = 8)

/**
 * Templo no arco — arte OFICIAL (Temple-Only, autorizado pelo guia 2027 p. 6 para espaços
 * pequenos), recortada do PNG original em português sem redesenho nem recoloração.
 * O recorte é limitado pela própria forma do arco. Sem sombra, sem gradiente, sem animar partes.
 */
@Composable
fun FsyTempleMark(
    modifier: Modifier = Modifier,
    height: Dp = 40.dp,
    decorative: Boolean = false,
) {
    Image(
        painter = painterResource(id = R.drawable.fsy_official_temple_only),
        contentDescription = if (decorative) null else "Templo no arco, símbolo do tema 2027",
        contentScale = ContentScale.Fit,
        modifier = modifier
            .height(height)
            .aspectRatio(439f / 906f)
            .clip(FsyOfficialArchShape),
    )
}

/** Arco do identificador oficial: semicírculo no topo, base reta. */
val FsyOfficialArchShape = RoundedCornerShape(topStartPercent = 50, topEndPercent = 50, bottomStartPercent = 0, bottomEndPercent = 0)

/**
 * Identificador oficial completo (templo + "Alegrar-se em Cristo / Filipenses 4:4"), PNG original.
 * O original tem fundo branco: use apenas sobre superfície clara (a função já aplica a placa).
 */
@Composable
fun FsyOfficialMark(
    modifier: Modifier = Modifier,
    horizontal: Boolean = false,
) {
    Image(
        painter = painterResource(id = if (horizontal) R.drawable.fsy_official_mark_horizontal else R.drawable.fsy_official_mark_vertical),
        contentDescription = "Alegrar-se em Cristo, Filipenses 4:4 — tema FSY 2027",
        contentScale = ContentScale.Fit,
        modifier = modifier
            .aspectRatio(if (horizontal) 1362f / 792f else 867f / 1374f)
            .background(Color.White),
    )
}

/**
 * Selo do templo oficial (Temple-Only). Assinatura mantida para chamadas existentes.
 */
@Composable
fun FsyDiscLogo(
    size: Dp = 56.dp,
    modifier: Modifier = Modifier,
) {
    FsyTempleMark(modifier = modifier, height = size)
}

/** Letreiro oficial do tema (PNG original, sem recompor tipografia). Fundo branco do original. */
@Composable
fun FsyThemeLockup(
    modifier: Modifier = Modifier,
) {
    Image(
        painter = painterResource(id = R.drawable.fsy_official_wordmark_centered),
        contentDescription = "Alegrar-se em Cristo, Filipenses 4:4",
        contentScale = ContentScale.Fit,
        modifier = modifier
            .aspectRatio(867f / 393f)
            .background(Color.White),
    )
}
