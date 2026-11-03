package br.com.fsyrp2.app.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.Composable
import androidx.compose.runtime.key
import androidx.compose.ui.unit.dp

/** Grupos editoriais de ordem fixa. Não há preferências de layout por conta. */
data class FsyCardContent(val id: String, val title: String, val content: @Composable () -> Unit)

@Composable
fun FsyCardGroup(cards: List<FsyCardContent>) {
    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        cards.forEach { card -> key(card.id) { card.content() } }
    }
}
