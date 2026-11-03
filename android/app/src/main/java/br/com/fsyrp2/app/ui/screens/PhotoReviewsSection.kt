package br.com.fsyrp2.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.background
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.ui.unit.dp
import br.com.fsyrp2.app.model.ProfilePhotoReview
import br.com.fsyrp2.app.state.FsyAppState
import br.com.fsyrp2.app.ui.components.*

/** A lista só é consultada por consultores e cargos autorizados na API. */
@Composable
internal fun PhotoReviewsSection(appState: FsyAppState) {
    if (!appState.canReviewPhotos) return
    var rejecting by remember { mutableStateOf<ProfilePhotoReview?>(null) }
    var busyId by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(Unit) { appState.refreshPhotoReviews() }

    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        FsySectionTitle("Fotos para aprovar (${appState.photoReviews.size})")
        error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        if (appState.photoReviews.isEmpty()) {
            Text("Todas as fotos foram analisadas.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        appState.photoReviews.forEach { review ->
            key(review.userId) {
                FsySectionCard {
                    Text(review.fullName, style = MaterialTheme.typography.titleLarge)
                    review.companyName?.let { Text(it, style = MaterialTheme.typography.bodyMedium) }
                    RemotePublicImage(
                        url = review.pendingUrl,
                        contentDescription = "Foto enviada por ${review.fullName}",
                        modifier = Modifier.padding(vertical = 12.dp).widthIn(max = 440.dp).fillMaxWidth()
                            .aspectRatio(1f).align(Alignment.CenterHorizontally).clip(FsyControlShape)
                            .background(MaterialTheme.colorScheme.surfaceContainerHigh),
                        contentScale = ContentScale.Fit,
                        onError = { appState.refreshPhotoReviews() },
                    )
                    FsyButton(
                        onClick = {
                            busyId = review.userId
                            error = null
                            appState.reviewPhoto(review.userId, true, null) { error = it; busyId = null }
                        },
                        enabled = busyId == null,
                        modifier = Modifier.fillMaxWidth(),
                    ) { Text(if (busyId == review.userId) "Enviando…" else "Aprovar") }
                    FsyOutlinedButton(
                        onClick = { rejecting = review },
                        enabled = busyId == null,
                        modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    ) { Text("Não aprovar") }
                }
            }
        }
    }
    rejecting?.let { review ->
        FsyReasonDialog(
            title = "Não aprovar foto",
            message = "Explique para ${review.fullName} o que precisa mudar na próxima foto.",
            confirmLabel = "Enviar motivo",
            busy = busyId != null,
            onDismiss = { rejecting = null },
            onConfirm = { reason ->
                busyId = review.userId
                appState.reviewPhoto(review.userId, false, reason) {
                    error = it
                    busyId = null
                    if (it == null) rejecting = null
                }
            },
        )
    }
}
