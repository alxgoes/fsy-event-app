package br.com.fsyrp2.app.update

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import br.com.fsyrp2.app.BuildConfig
import br.com.fsyrp2.app.state.FsyAppState
import br.com.fsyrp2.app.ui.components.FsyButton
import br.com.fsyrp2.app.ui.components.FsyEventFacts
import br.com.fsyrp2.app.ui.components.FsyGutter
import br.com.fsyrp2.app.ui.components.FsyOutlinedButton
import br.com.fsyrp2.app.ui.components.FsySectionCard
import br.com.fsyrp2.app.ui.components.FsySectionTitle
import br.com.fsyrp2.app.ui.components.FsySwitch
import br.com.fsyrp2.app.ui.components.FsyTempleMark
import br.com.fsyrp2.app.ui.components.FsyTextButton
import br.com.fsyrp2.app.ui.components.FsyTopBar
import br.com.fsyrp2.app.ui.components.isCompactActionLayout
import br.com.fsyrp2.app.ui.icons.FsyIcons
import br.com.fsyrp2.app.ui.motion.rememberFsyHaptics
import br.com.fsyrp2.app.ui.theme.TabularTextStyle

@Composable
fun FsyUpdateBanner(
    appState: FsyAppState,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val haptics = rememberFsyHaptics()
    val postNotice = appState.postUpdateNotice
    val uiState = appState.updateUiState
    val compact = isCompactActionLayout(minSideBySideWidthDp = 390)

    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (postNotice != null) {
            FsySectionCard(contentPadding = PaddingValues(16.dp)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Icon(
                        imageVector = FsyIcons.Sparkles,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(20.dp),
                    )
                    Text(
                        text = "Atualizado para a versão ${postNotice.versionName}",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.weight(1f),
                    )
                }
                if (postNotice.releaseNotesPtBr.isNotEmpty()) {
                    Spacer(Modifier.height(6.dp))
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        postNotice.releaseNotesPtBr.forEach { line ->
                            Text(
                                text = "• $line",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
                Spacer(Modifier.height(8.dp))
                FsyTextButton(
                    onClick = {
                        haptics.tick()
                        appState.dismissPostUpdateNotice()
                    },
                    modifier = Modifier.align(Alignment.End),
                ) {
                    Text("Entendi")
                }
            }
        }

        if (uiState.isMandatoryBlocking) return@Column

        when (uiState) {
            is AppUpdateUiState.Available -> {
                val u = uiState.update
                FsySectionCard(contentPadding = PaddingValues(16.dp)) {
                    if (compact) {
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(10.dp),
                            ) {
                                Icon(
                                    imageVector = FsyIcons.Download,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.size(20.dp),
                                )
                                Text(
                                    text = "Nova versão ${u.versionName} disponível",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.weight(1f),
                                )
                            }
                            if (u.releaseNotesPtBr.isNotEmpty()) {
                                Text(
                                    text = u.releaseNotesPtBr.first(),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                            FsyButton(
                                onClick = {
                                    haptics.confirm()
                                    appState.startUpdateDownload(allowMetered = false)
                                },
                                modifier = Modifier.fillMaxWidth().defaultMinSize(minHeight = 48.dp),
                            ) {
                                Text("Atualizar")
                            }
                        }
                    } else {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            Icon(
                                imageVector = FsyIcons.Download,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(20.dp),
                            )
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = "Nova versão ${u.versionName} disponível",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold,
                                )
                                if (u.releaseNotesPtBr.isNotEmpty()) {
                                    Text(
                                        text = u.releaseNotesPtBr.first(),
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                            }
                            FsyButton(
                                onClick = {
                                    haptics.confirm()
                                    appState.startUpdateDownload(allowMetered = false)
                                },
                                modifier = Modifier.defaultMinSize(minHeight = 48.dp),
                            ) {
                                Text("Atualizar")
                            }
                        }
                    }
                }
            }

            is AppUpdateUiState.AwaitingMeteredConfirmation -> {
                val u = uiState.update
                FsySectionCard(contentPadding = PaddingValues(16.dp)) {
                    Text(
                        text = "Nova versão ${u.versionName} disponível",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = "Você está usando dados móveis. Deseja baixar a atualização mesmo assim?",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(10.dp))
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        FsyButton(
                            onClick = {
                                haptics.confirm()
                                appState.startUpdateDownload(allowMetered = true)
                            },
                            modifier = Modifier.fillMaxWidth().defaultMinSize(minHeight = 48.dp),
                        ) {
                            Text("Baixar agora")
                        }
                        FsyOutlinedButton(
                            onClick = {
                                haptics.tick()
                                appState.cancelMeteredDownloadPrompt()
                            },
                            modifier = Modifier.fillMaxWidth().defaultMinSize(minHeight = 48.dp),
                        ) {
                            Text("Mais tarde")
                        }
                    }
                }
            }

            is AppUpdateUiState.Downloading -> {
                val pct = uiState.progressFraction?.let { (it * 100).toInt().coerceIn(0, 100) }
                FsySectionCard(contentPadding = PaddingValues(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = "Baixando…",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.weight(1f),
                        )
                        if (pct != null) {
                            Text(
                                text = "$pct%",
                                style = MaterialTheme.typography.labelLarge.merge(TabularTextStyle),
                                color = MaterialTheme.colorScheme.primary,
                            )
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                    if (uiState.progressFraction != null) {
                        LinearProgressIndicator(
                            progress = { uiState.progressFraction.coerceIn(0f, 1f) },
                            modifier = Modifier.fillMaxWidth(),
                        )
                    } else {
                        LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                    }
                }
            }

            is AppUpdateUiState.ReadyToInstall -> {
                val u = uiState.update
                FsySectionCard(contentPadding = PaddingValues(16.dp)) {
                    Text(
                        text = "Nova versão ${u.versionName} pronta para instalar",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                    )
                    Spacer(Modifier.height(10.dp))
                    FsyButton(
                        onClick = {
                            haptics.confirm()
                            appState.triggerUpdateInstall(context)
                        },
                        modifier = Modifier.fillMaxWidth().defaultMinSize(minHeight = 48.dp),
                    ) {
                        Text("Atualizar")
                    }
                }
            }

            is AppUpdateUiState.NeedsInstallPermission -> {
                FsySectionCard(contentPadding = PaddingValues(16.dp)) {
                    Text(
                        text = "Permitir atualizar por aqui",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = "Na primeira vez, ative a opção \"Permitir desta fonte\" para que o próprio aplicativo instale as novas versões.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(10.dp))
                    FsyButton(
                        onClick = {
                            haptics.confirm()
                            appState.openInstallPermissionSettings(context)
                        },
                        modifier = Modifier.fillMaxWidth().defaultMinSize(minHeight = 48.dp),
                    ) {
                        Text("Permitir desta fonte")
                    }
                }
            }

            is AppUpdateUiState.Installing -> {
                FsySectionCard(contentPadding = PaddingValues(16.dp)) {
                    Text(
                        text = "Instalando versão ${uiState.update.versionName}…",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                    )
                    Spacer(Modifier.height(8.dp))
                    LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                }
            }

            is AppUpdateUiState.Error -> {
                FsySectionCard(contentPadding = PaddingValues(16.dp)) {
                    Row(
                        verticalAlignment = Alignment.Top,
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        Icon(
                            imageVector = FsyIcons.CircleAlert,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.error,
                            modifier = Modifier.size(20.dp),
                        )
                        Text(
                            text = uiState.messagePtBr,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurface,
                            modifier = Modifier.weight(1f),
                        )
                    }
                    Spacer(Modifier.height(10.dp))
                    FsyOutlinedButton(
                        onClick = {
                            haptics.confirm()
                            appState.retryUpdateAction()
                        },
                        modifier = Modifier.fillMaxWidth().defaultMinSize(minHeight = 48.dp),
                    ) {
                        Icon(FsyIcons.RefreshCw, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Tentar de novo")
                    }
                }
            }

            else -> Unit
        }
    }
}

@Composable
fun MandatoryUpdateScreen(appState: FsyAppState) {
    val context = LocalContext.current
    val haptics = rememberFsyHaptics()
    val uiState = appState.updateUiState
    val update = uiState.activeUpdate

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background,
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .windowInsetsPadding(WindowInsets.safeDrawing)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            FsyTempleMark(height = 84.dp)
            Spacer(Modifier.height(20.dp))
            Text(
                text = "Atualize para continuar",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                modifier = Modifier.semantics { heading() },
            )
            Spacer(Modifier.height(10.dp))
            Text(
                text = if (update != null) {
                    "A versão ${update.versionName} é necessária para continuar usando o aplicativo da ${FsyEventFacts.SESSION}."
                } else {
                    "Uma nova versão obrigatória está disponível para continuar usando o aplicativo."
                },
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )

            if (update != null && update.releaseNotesPtBr.isNotEmpty()) {
                Spacer(Modifier.height(16.dp))
                FsySectionCard(contentPadding = PaddingValues(16.dp)) {
                    Text(
                        text = "O que mudou na versão ${update.versionName}",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                    )
                    Spacer(Modifier.height(6.dp))
                    update.releaseNotesPtBr.forEach { note ->
                        Text(
                            text = "• $note",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }

            Spacer(Modifier.height(24.dp))

            when (uiState) {
                is AppUpdateUiState.Downloading -> {
                    val pct = uiState.progressFraction?.let { (it * 100).toInt().coerceIn(0, 100) }
                    Text(
                        text = if (pct != null) "Baixando… $pct%" else "Baixando…",
                        style = MaterialTheme.typography.titleMedium.merge(TabularTextStyle),
                        fontWeight = FontWeight.Bold,
                    )
                    Spacer(Modifier.height(10.dp))
                    if (uiState.progressFraction != null) {
                        LinearProgressIndicator(
                            progress = { uiState.progressFraction.coerceIn(0f, 1f) },
                            modifier = Modifier.fillMaxWidth(),
                        )
                    } else {
                        LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                    }
                }

                is AppUpdateUiState.Installing -> {
                    Text(
                        text = "Instalando…",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                    )
                    Spacer(Modifier.height(10.dp))
                    LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                }

                is AppUpdateUiState.NeedsInstallPermission -> {
                    Text(
                        text = "Na primeira atualização, ative a permissão \"Permitir desta fonte\" na próxima tela do Android.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                    )
                    Spacer(Modifier.height(14.dp))
                    FsyButton(
                        onClick = {
                            haptics.confirm()
                            appState.openInstallPermissionSettings(context)
                        },
                        modifier = Modifier.fillMaxWidth().defaultMinSize(minHeight = 48.dp),
                    ) {
                        Text("Permitir desta fonte")
                    }
                }

                is AppUpdateUiState.ReadyToInstall -> {
                    FsyButton(
                        onClick = {
                            haptics.confirm()
                            appState.triggerUpdateInstall(context)
                        },
                        modifier = Modifier.fillMaxWidth().defaultMinSize(minHeight = 48.dp),
                    ) {
                        Text("Atualizar")
                    }
                }

                is AppUpdateUiState.Error -> {
                    Text(
                        text = uiState.messagePtBr,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.error,
                        textAlign = TextAlign.Center,
                    )
                    Spacer(Modifier.height(14.dp))
                    FsyButton(
                        onClick = {
                            haptics.confirm()
                            appState.retryUpdateAction()
                        },
                        modifier = Modifier.fillMaxWidth().defaultMinSize(minHeight = 48.dp),
                    ) {
                        Icon(FsyIcons.RefreshCw, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Tentar de novo")
                    }
                }

                else -> {
                    FsyButton(
                        onClick = {
                            haptics.confirm()
                            appState.startUpdateDownload(allowMetered = true)
                        },
                        modifier = Modifier.fillMaxWidth().defaultMinSize(minHeight = 48.dp),
                    ) {
                        Icon(FsyIcons.Download, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Atualizar")
                    }
                }
            }
        }
    }
}

@Composable
fun AboutAppScreen(appState: FsyAppState) {
    val haptics = rememberFsyHaptics()
    val installedVersion = BuildConfig.VERSION_NAME.removeSuffix("-debug")
    val uiState = appState.updateUiState
    val isChecking = uiState is AppUpdateUiState.Checking

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            FsyTopBar(
                title = "Sobre o app",
                onBack = {
                    haptics.tick()
                    appState.closeOverlay()
                },
            )
        },
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = FsyGutter, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            FsyUpdateBanner(appState = appState)

            FsySectionCard(contentPadding = PaddingValues(18.dp)) {
                Text(
                    text = FsyEventFacts.SESSION,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text = "Versão instalada: $installedVersion (código ${BuildConfig.VERSION_CODE})",
                    style = MaterialTheme.typography.bodyLarge.merge(TabularTextStyle),
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.SemiBold,
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text = "Última verificação: ${appState.lastUpdateCheckLabel ?: "Ainda não verificada"}",
                    style = MaterialTheme.typography.bodyMedium.merge(TabularTextStyle),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (uiState is AppUpdateUiState.UpToDate) {
                    Spacer(Modifier.height(6.dp))
                    Text(
                        text = "Você já está na versão mais recente.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
                Spacer(Modifier.height(14.dp))
                FsyOutlinedButton(
                    onClick = {
                        haptics.confirm()
                        appState.checkForAppUpdate(force = true)
                    },
                    enabled = !isChecking && uiState !is AppUpdateUiState.Downloading && uiState !is AppUpdateUiState.Installing,
                    modifier = Modifier.fillMaxWidth().defaultMinSize(minHeight = 48.dp),
                ) {
                    Icon(FsyIcons.RefreshCw, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(if (isChecking) "Verificando…" else "Verificar atualização")
                }
            }

            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                FsySectionTitle("Preferências")
                FsySectionCard(contentPadding = PaddingValues(18.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Atualizar automaticamente",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold,
                            )
                            Text(
                                text = "Baixa novas versões em segundo plano no Wi-Fi. Quando desligado, o aplicativo apenas avisa quando houver atualização.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        FsySwitch(
                            checked = appState.autoUpdateEnabled,
                            onCheckedChange = { enabled ->
                                haptics.tick()
                                appState.updateAutoUpdatePreference(enabled)
                            },
                            modifier = Modifier.semantics { contentDescription = "Atualizar automaticamente" },
                        )
                    }
                }
            }

            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                FsySectionTitle("Como funcionam as atualizações")
                FsySectionCard(contentPadding = PaddingValues(18.dp)) {
                    Text(
                        text = "As novas versões oficiais são verificadas com código de segurança antes da instalação, preservando sua conta e suas preferências sem precisar desinstalar o aplicativo.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = "No Android 12 ou superior, a partir da segunda atualização feita pelo próprio aplicativo, a instalação acontece direto; alguns aparelhos ou o Play Protect ainda podem exibir uma confirmação.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}
