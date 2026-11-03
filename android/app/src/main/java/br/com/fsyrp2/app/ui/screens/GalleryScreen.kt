package br.com.fsyrp2.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.calculatePan
import androidx.compose.foundation.gestures.calculateZoom
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.ui.input.pointer.positionChanged
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.itemsIndexed
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import br.com.fsyrp2.app.model.InstagramPost
import br.com.fsyrp2.app.state.FsyAppState
import br.com.fsyrp2.app.ui.components.*
import br.com.fsyrp2.app.ui.icons.FsyIcons
import br.com.fsyrp2.app.ui.motion.rememberFsyHaptics
import br.com.fsyrp2.app.ui.theme.TabularTextStyle

/** Uma foto da grade: imagem, legenda e para onde "abrir" leva (Instagram ou Drive). */
private data class GalleryPhoto(val imageUrl: String, val caption: String, val externalUrl: String, val externalLabel: String)

/**
 * Fotos: grade de 3 colunas no estilo de perfil social, com visualização em tela cheia
 * (deslizar entre fotos, pinça para ampliar). Instagram oficial da sessão e álbuns do Drive.
 */
@Composable
fun GalleryScreen(appState: FsyAppState) {
    val context = LocalContext.current
    val haptics = rememberFsyHaptics()
    var section by rememberSaveable { mutableStateOf(0) }
    var viewerIndex by rememberSaveable { mutableStateOf<Int?>(null) }

    val instagram = remember(appState.instagramPosts) {
        appState.instagramPosts.map { GalleryPhoto(it.imageUrl, it.caption, it.permalink, "Abrir no Instagram") }
    }
    val albums = remember(appState.publicMediaPhotos) {
        appState.publicMediaPhotos.map { GalleryPhoto(it.thumbnailUrl.orEmpty(), it.title, it.driveUrl, "Abrir álbum no Drive") }
    }
    val hasAlbums = albums.isNotEmpty()
    val photos = if (section == 1 && hasAlbums) albums else instagram

    Column(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.navigationBars)) {
        FsyTopBar(title = "Fotos", onBack = {
            haptics.tick()
            appState.closeOverlay()
        })
        LazyVerticalGrid(
            columns = GridCells.Fixed(3),
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 24.dp),
            horizontalArrangement = Arrangement.spacedBy(3.dp),
            verticalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            item(key = "header", span = { GridItemSpan(maxLineSpan) }) {
                Column(
                    modifier = Modifier.padding(horizontal = FsyGutter).padding(top = 4.dp, bottom = 14.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                        // Templo oficial numa placa clara circular: sem recolorir, sem sombra.
                        Box(
                            modifier = Modifier
                                .size(72.dp)
                                .border(2.dp, MaterialTheme.colorScheme.primary, CircleShape)
                                .padding(4.dp)
                                .clip(CircleShape)
                                .background(Color.White),
                            contentAlignment = Alignment.Center,
                        ) { FsyTempleMark(height = 50.dp, decorative = true) }
                        Column(Modifier.weight(1f)) {
                            Text(
                                "@${InstagramPost.OFFICIAL_HANDLE}",
                                style = MaterialTheme.typography.titleMedium,
                                color = MaterialTheme.colorScheme.onSurface,
                            )
                            Text(
                                if (instagram.isNotEmpty()) "${instagram.size} publicações recentes" else "Instagram oficial da sessão",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                    FsyOutlinedButton(
                        onClick = {
                            haptics.confirm()
                            ExternalUrlLauncher.openExternalUrl(context, appState.instagramProfileUrl)
                        },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Icon(FsyIcons.ExternalLink, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.size(8.dp))
                        Text("Seguir no Instagram")
                    }
                    if (hasAlbums) {
                        FsySegmentedSelector(
                            options = listOf("Instagram", "Álbuns da sessão"),
                            selectedIndex = section,
                            onSelect = {
                                haptics.tick()
                                section = it
                            },
                        )
                    }
                }
            }
            if (photos.isEmpty()) {
                item(key = "empty", span = { GridItemSpan(maxLineSpan) }) {
                    FsyEmptyStateCard(
                        icon = FsyIcons.Camera,
                        title = "Sem fotos por enquanto",
                        description = "As fotos de cada dia aparecem aqui. Enquanto isso, acompanhe pelo Instagram.",
                    )
                }
            } else {
                itemsIndexed(photos, key = { i, p -> "$section-$i-${p.imageUrl}" }) { index, photo ->
                    Box(
                        modifier = Modifier
                            .aspectRatio(1f)
                            .clickable(role = Role.Button, onClickLabel = "Ver em tela cheia") {
                                haptics.tick()
                                viewerIndex = index
                            },
                    ) {
                        RemotePublicImage(
                            url = photo.imageUrl,
                            contentDescription = photo.caption.ifBlank { "Foto ${index + 1}" },
                            maxDimensionPx = 480,
                            modifier = Modifier.fillMaxSize(),
                        )
                        if (section == 1 && photo.caption.isNotBlank()) {
                            Box(
                                Modifier
                                    .align(Alignment.BottomStart)
                                    .fillMaxWidth()
                                    .background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(alpha = 0.65f))))
                                    .padding(horizontal = 8.dp, vertical = 6.dp),
                            ) {
                                Text(photo.caption, color = Color.White, style = MaterialTheme.typography.labelMedium, maxLines = 2, overflow = TextOverflow.Ellipsis)
                            }
                        }
                    }
                }
            }
        }
    }

    val start = viewerIndex
    if (start != null && photos.isNotEmpty()) {
        PhotoViewer(
            photos = photos,
            startIndex = start.coerceIn(0, photos.lastIndex),
            onClose = { viewerIndex = null },
            onOpenExternal = { url -> ExternalUrlLauncher.openExternalUrl(context, url) },
        )
    }
}

@Composable
private fun PhotoViewer(
    photos: List<GalleryPhoto>,
    startIndex: Int,
    onClose: () -> Unit,
    onOpenExternal: (String) -> Unit,
) {
    Dialog(onDismissRequest = onClose, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        val pager = rememberPagerState(initialPage = startIndex) { photos.size }
        Box(Modifier.fillMaxSize().background(Color.Black)) {
            HorizontalPager(state = pager, modifier = Modifier.fillMaxSize(), beyondViewportPageCount = 1) { page ->
                ZoomableImage(photos[page])
            }
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .windowInsetsPadding(WindowInsets.statusBars)
                    .padding(horizontal = 8.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "${pager.currentPage + 1} de ${photos.size}",
                    style = MaterialTheme.typography.labelLarge.merge(TabularTextStyle),
                    color = Color.White,
                    modifier = Modifier.weight(1f).padding(start = 12.dp),
                )
                FsyIconButton(icon = FsyIcons.X, contentDescription = "Fechar", onClick = onClose, tint = Color.White)
            }
            val current = photos.getOrNull(pager.currentPage)
            if (current != null) {
                Column(
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .fillMaxWidth()
                        .background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(alpha = 0.85f))))
                        .windowInsetsPadding(WindowInsets.navigationBars)
                        .padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    if (current.caption.isNotBlank()) {
                        Text(current.caption, style = MaterialTheme.typography.bodyMedium, color = Color.White, modifier = Modifier.heightIn(max = 180.dp).verticalScroll(rememberScrollState()))
                    }
                    if (current.externalUrl.isNotBlank()) {
                        FsyOutlinedButton(
                            onClick = { onOpenExternal(current.externalUrl) },
                            colors = ButtonDefaults.outlinedButtonColors(containerColor = Color.Transparent, contentColor = Color.White),
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Icon(FsyIcons.ExternalLink, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.size(8.dp))
                            Text(current.externalLabel)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ZoomableImage(photo: GalleryPhoto) {
    var scale by remember { mutableFloatStateOf(1f) }
    var offsetX by remember { mutableFloatStateOf(0f) }
    var offsetY by remember { mutableFloatStateOf(0f) }
    Box(
        Modifier
            .fillMaxSize()
            .pointerInput(Unit) {
                // Toque duplo alterna entre 1x e 2,5x.
                detectTapGestures(onDoubleTap = {
                    if (scale > 1f) {
                        scale = 1f; offsetX = 0f; offsetY = 0f
                    } else scale = 2.5f
                })
            }
            .pointerInput(Unit) {
                // Pinça amplia. Com zoom 1x e um dedo, o arraste fica com o paginador (deslizar entre fotos).
                awaitEachGesture {
                    awaitFirstDown(requireUnconsumed = false)
                    do {
                        val event = awaitPointerEvent()
                        val fingers = event.changes.count { it.pressed }
                        if (fingers >= 2 || scale > 1f) {
                            val next = (scale * event.calculateZoom()).coerceIn(1f, 4f)
                            scale = next
                            if (next > 1f) {
                                val pan = event.calculatePan()
                                offsetX += pan.x
                                offsetY += pan.y
                            } else {
                                offsetX = 0f
                                offsetY = 0f
                            }
                            event.changes.forEach { if (it.positionChanged()) it.consume() }
                        }
                    } while (event.changes.any { it.pressed })
                }
            },
        contentAlignment = Alignment.Center,
    ) {
        RemotePublicImage(
            url = photo.imageUrl,
            contentDescription = photo.caption.ifBlank { "Foto" },
            contentScale = ContentScale.Fit,
            modifier = Modifier
                .fillMaxSize()
                .graphicsLayer {
                    scaleX = scale
                    scaleY = scale
                    translationX = offsetX
                    translationY = offsetY
                },
        )
    }
}
