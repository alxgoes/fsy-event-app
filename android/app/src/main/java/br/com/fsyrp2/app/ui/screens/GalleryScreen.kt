package br.com.fsyrp2.app.ui.screens

import br.com.fsyrp2.app.ui.icons.FsyIcons
import br.com.fsyrp2.app.ui.components.FsyTopBar
import br.com.fsyrp2.app.ui.components.FsySegmentedSelector

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import br.com.fsyrp2.app.state.FsyAppState
import br.com.fsyrp2.app.state.OverlayDestination
import br.com.fsyrp2.app.ui.components.ExternalUrlLauncher
import br.com.fsyrp2.app.ui.components.FsyEmptyStateCard
import br.com.fsyrp2.app.ui.components.FsySectionCard
import br.com.fsyrp2.app.ui.components.RemotePublicImage
import br.com.fsyrp2.app.ui.motion.rememberFsyHaptics

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GalleryScreen(appState: FsyAppState) {
    val context = LocalContext.current
    val haptics = rememberFsyHaptics()
    var activeSection by remember { mutableStateOf("instagram") }
    var zoomedImageUrl by remember { mutableStateOf<String?>(null) }
    var zoomedCaption by remember { mutableStateOf<String?>(null) }
    var zoomedExternalUrl by remember { mutableStateOf<String?>(null) }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            FsyTopBar(
                title = "Galeria",
                subtitle = "Fotos e publicações",
                onBack = {
                    haptics.tick()
                    appState.overlayDestination = OverlayDestination.None
                }
            )
        }
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 16.dp),
            contentPadding = PaddingValues(vertical = 14.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                FsySegmentedSelector(
                    options = listOf("Instagram", "Fotos da sessão"),
                    selectedIndex = if (activeSection == "session") 1 else 0,
                    onSelect = { index ->
                        haptics.tick()
                        activeSection = if (index == 1) "session" else "instagram"
                    }
                )
            }
            if (activeSection == "instagram") {
                item {
                    OutlinedButton(
                        onClick = {
                            haptics.confirm()
                            ExternalUrlLauncher.openExternalUrl(context, appState.instagramProfileUrl)
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .defaultMinSize(minHeight = 48.dp)
                    ) {
                        Icon(FsyIcons.ExternalLink, contentDescription = null)
                        Spacer(Modifier.width(8.dp))
                        Text("Abrir no Instagram")
                    }
                }

                if (appState.instagramPosts.isEmpty()) {
                    item {
                        FsyEmptyStateCard(
                            icon = FsyIcons.Camera,
                            title = "Sem publicações agora",
                            description = "Abra o Instagram para ver as últimas."
                        )
                    }
                } else {
                    items(appState.instagramPosts, key = { it.id }) { post ->
                        FsySectionCard {
                            RemotePublicImage(
                                url = post.imageUrl,
                                contentDescription = post.caption.ifBlank { "Publicação do Instagram FSY" },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(220.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .clickable {
                                        haptics.tick()
                                        zoomedImageUrl = post.imageUrl
                                        zoomedCaption = post.caption
                                        zoomedExternalUrl = post.permalink
                                    }
                            )
                            Spacer(Modifier.height(10.dp))
                            if (post.caption.isNotBlank()) {
                                Text(
                                    text = post.caption,
                                    style = MaterialTheme.typography.bodyMedium,
                                    maxLines = 3,
                                    overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                                )
                                Spacer(Modifier.height(8.dp))
                            }
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                TextButton(
                                    onClick = {
                                        zoomedImageUrl = post.imageUrl
                                        zoomedCaption = post.caption
                                        zoomedExternalUrl = post.permalink
                                    },
                                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                                ) {
                                    Text("Ampliar")
                                }
                                TextButton(
                                    onClick = {
                                        ExternalUrlLauncher.openExternalUrl(context, post.permalink)
                                    },
                                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                                ) {
                                    Icon(FsyIcons.ExternalLink, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(Modifier.width(4.dp))
                                    Text("Ver no Instagram")
                                }
                            }
                        }
                    }
                }
            } else {
                if (appState.publicMediaPhotos.isEmpty()) {
                    item {
                        FsyEmptyStateCard(
                            icon = FsyIcons.Images,
                            title = "Nenhuma foto ainda",
                            description = "As fotos de cada dia aparecem aqui."
                        )
                    }
                } else {
                    items(appState.publicMediaPhotos, key = { it.id }) { photo ->
                        FsySectionCard {
                            if (!photo.thumbnailUrl.isNullOrBlank()) {
                                RemotePublicImage(
                                    url = photo.thumbnailUrl,
                                    contentDescription = photo.title,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(200.dp)
                                        .clip(RoundedCornerShape(12.dp))
                                        .clickable {
                                            zoomedImageUrl = photo.thumbnailUrl
                                            zoomedCaption = photo.title
                                            zoomedExternalUrl = photo.driveUrl
                                        }
                                )
                                Spacer(Modifier.height(10.dp))
                            }
                            Text(
                                text = photo.title,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(Modifier.height(8.dp))
                            OutlinedButton(
                                onClick = {
                                    ExternalUrlLauncher.openExternalUrl(context, photo.driveUrl)
                                },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .defaultMinSize(minHeight = 48.dp)
                            ) {
                                Icon(FsyIcons.ExternalLink, contentDescription = null)
                                Spacer(Modifier.width(8.dp))
                                Text("Abrir no Drive")
                            }
                        }
                    }
                }
            }
        }
    }

    if (zoomedImageUrl != null) {
        Dialog(
            onDismissRequest = { zoomedImageUrl = null },
            properties = DialogProperties(usePlatformDefaultWidth = false)
        ) {
            var scale by remember { mutableFloatStateOf(1f) }
            var offsetX by remember { mutableFloatStateOf(0f) }
            var offsetY by remember { mutableFloatStateOf(0f) }

            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.92f))
                    .pointerInput(Unit) {
                        detectTransformGestures { _, pan, zoom, _ ->
                            scale = (scale * zoom).coerceIn(1f, 4f)
                            if (scale > 1f) {
                                offsetX += pan.x
                                offsetY += pan.y
                            } else {
                                offsetX = 0f
                                offsetY = 0f
                            }
                        }
                    }
            ) {
                RemotePublicImage(
                    url = zoomedImageUrl.orEmpty(),
                    contentDescription = zoomedCaption,
                    contentScale = ContentScale.Fit,
                    modifier = Modifier
                        .fillMaxSize()
                        .graphicsLayer {
                            scaleX = scale
                            scaleY = scale
                            translationX = offsetX
                            translationY = offsetY
                        }
                )

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .align(Alignment.TopEnd)
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.End
                ) {
                    IconButton(
                        onClick = { zoomedImageUrl = null },
                        modifier = Modifier.size(48.dp)
                    ) {
                        Icon(
                            imageVector = FsyIcons.X,
                            contentDescription = "Fechar visualização ampliada",
                            tint = Color.White
                        )
                    }
                }

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .align(Alignment.BottomCenter)
                        .background(Color.Black.copy(alpha = 0.72f))
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    if (!zoomedCaption.isNullOrBlank()) {
                        Text(
                            text = zoomedCaption.orEmpty(),
                            style = MaterialTheme.typography.bodySmall,
                            color = Color.White,
                            maxLines = 3
                        )
                    }
                    if (!zoomedExternalUrl.isNullOrBlank()) {
                        OutlinedButton(
                            onClick = {
                                ExternalUrlLauncher.openExternalUrl(context, zoomedExternalUrl.orEmpty())
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .defaultMinSize(minHeight = 48.dp)
                        ) {
                            Icon(FsyIcons.ExternalLink, contentDescription = null, tint = Color.White)
                            Spacer(Modifier.width(8.dp))
                            Text("Abrir publicação", color = Color.White)
                        }
                    }
                }
            }
        }
    }
}
