package br.com.fsyrp2.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.compose.animation.AnimatedContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import br.com.fsyrp2.app.state.FsyAppState
import br.com.fsyrp2.app.state.FsyAppViewModel
import br.com.fsyrp2.app.state.MainTab
import br.com.fsyrp2.app.state.OverlayDestination
import br.com.fsyrp2.app.ui.components.FsyEventFacts
import br.com.fsyrp2.app.ui.components.FsyNavDestination
import br.com.fsyrp2.app.ui.components.FsyNavigationBar
import br.com.fsyrp2.app.ui.components.FsyTempleMark
import br.com.fsyrp2.app.ui.icons.FsyIcons
import br.com.fsyrp2.app.ui.motion.fsyContentSwap
import br.com.fsyrp2.app.ui.motion.fsyMotionPreferences
import br.com.fsyrp2.app.ui.motion.fsyPushTransition
import br.com.fsyrp2.app.ui.motion.rememberFsyHaptics
import br.com.fsyrp2.app.ui.screens.*
import br.com.fsyrp2.app.ui.screens.admin.AdminHubScreen
import br.com.fsyrp2.app.ui.theme.FsyTheme
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    // Estado no ViewModel: rotação, troca de tema ou fonte não voltam ao Início nem apagam formulários.
    private val viewModel: FsyAppViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val appState = viewModel.state
        lifecycleScope.launch {
            // Revalida ao voltar ao app e a cada minuto somente enquanto a tela está ativa.
            repeatOnLifecycle(Lifecycle.State.RESUMED) {
                while (isActive) {
                    appState.refreshProfileAccess()
                    delay(60_000L)
                }
            }
        }
        if (savedInstanceState == null) {
            intent?.dataString?.let { appState.handleIncomingDeepLink(it) }
        }

        setContent {
            FsyTheme {
                FsyRootContent(appState = appState)
            }
        }
    }

    override fun onResume() {
        super.onResume()
        br.com.fsyrp2.app.ui.components.ExternalUrlLauncher.purgeExpiredPrivateDocuments(this)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        intent.dataString?.let { viewModel.state.handleIncomingDeepLink(it) }
    }
}

/** Chave estável de cada camada (o módulo inicial da gestão não troca a tela inteira). */
private fun OverlayDestination.layerKey(): String = when (this) {
    OverlayDestination.None -> "tabs"
    OverlayDestination.Gallery -> "gallery"
    OverlayDestination.NotificationSettings -> "notifications"
    OverlayDestination.CounselorPanel -> "counselor"
    is OverlayDestination.AdminHub -> "admin"
}

@Composable
internal fun FsyRootContent(appState: FsyAppState) {
    val haptics = rememberFsyHaptics()
    val reduceMotion = fsyMotionPreferences().reduceMotion

    if (appState.isBootstrapping) {
        // Abertura silenciosa: papel quente, templo e nome da sessão. Sem laço decorativo.
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background),
            contentAlignment = Alignment.Center
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                FsyTempleMark(height = 96.dp)
                Text(
                    text = FsyEventFacts.SESSION,
                    style = MaterialTheme.typography.titleLarge,
                    color = MaterialTheme.colorScheme.onBackground
                )
                CircularProgressIndicator(
                    modifier = Modifier.size(24.dp),
                    strokeWidth = 2.dp,
                    color = MaterialTheme.colorScheme.primary
                )
            }
        }
        return
    }

    if (appState.session == null) {
        AuthScreen(appState = appState)
        return
    }

    // Portão por papel também na renderização: destino de equipe sem permissão cai no Início.
    val requested = appState.overlayDestination
    val overlay = when (requested) {
        is OverlayDestination.CounselorPanel -> if (appState.canOpenCounselorPanel) requested else OverlayDestination.None
        is OverlayDestination.AdminHub -> if (appState.canOpenAdmin) requested else OverlayDestination.None
        else -> requested
    }
    LaunchedEffect(requested, overlay) {
        if (requested != overlay) appState.open(requested)
    }

    BackHandler(enabled = overlay != OverlayDestination.None) {
        appState.closeOverlay()
    }
    BackHandler(enabled = overlay == OverlayDestination.None && appState.selectedTab != MainTab.HOME) {
        appState.selectedTab = MainTab.HOME
    }

    val stateHolder = rememberSaveableStateHolder()
    androidx.compose.runtime.CompositionLocalProvider(
        androidx.compose.material3.LocalContentColor provides MaterialTheme.colorScheme.onBackground,
    ) {
        AnimatedContent(
            targetState = overlay,
            contentKey = { it.layerKey() },
            transitionSpec = {
                fsyPushTransition(forward = targetState != OverlayDestination.None, reduceMotion = reduceMotion)
            },
            label = "OverlayPush",
        ) { layer ->
            when (layer) {
                is OverlayDestination.Gallery -> GalleryScreen(appState = appState)
                is OverlayDestination.NotificationSettings -> NotificationSettingsScreen(appState = appState)
                is OverlayDestination.CounselorPanel -> CounselorScreen(appState = appState)
                is OverlayDestination.AdminHub -> AdminHubScreen(appState = appState, initialModule = layer.initialModule)
                OverlayDestination.None -> MainTabs(appState, stateHolder, reduceMotion, onTabTick = { haptics.tick() })
            }
        }
    }
}

@Composable
private fun MainTabs(
    appState: FsyAppState,
    stateHolder: androidx.compose.runtime.saveable.SaveableStateHolder,
    reduceMotion: Boolean,
    onTabTick: () -> Unit,
) {
    val tabs = MainTab.entries
    val destinations = tabs.map { tab ->
        FsyNavDestination(
            label = tab.label,
            icon = when (tab) {
                MainTab.HOME -> FsyIcons.LayoutDashboard
                MainTab.AGENDA -> FsyIcons.CalendarDays
                MainTab.ANNOUNCEMENTS -> FsyIcons.Megaphone
                MainTab.MORE -> FsyIcons.Menu
            },
            badgeCount = when (tab) {
                MainTab.ANNOUNCEMENTS -> appState.unreadAnnouncementCount
                MainTab.MORE -> if (appState.canReviewPhotos) appState.photoReviews.size else 0
                else -> 0
            },
        )
    }
    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        // Cada tela aplica o recuo da barra de status na própria barra superior.
        contentWindowInsets = WindowInsets(0, 0, 0, 0),
        bottomBar = {
            FsyNavigationBar(
                destinations = destinations,
                selectedIndex = tabs.indexOf(appState.selectedTab),
                onSelect = { index ->
                    val tab = tabs[index]
                    if (appState.selectedTab != tab) {
                        onTabTick()
                        appState.selectedTab = tab
                    }
                }
            )
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            AnimatedContent(
                targetState = appState.selectedTab,
                transitionSpec = { fsyContentSwap(reduceMotion) },
                label = "MainTabSwap"
            ) { currentTab ->
                // Rolagem de cada aba preservada ao trocar de aba e ao voltar de uma tela empilhada.
                stateHolder.SaveableStateProvider(currentTab.key) {
                    when (currentTab) {
                        MainTab.HOME -> HomeScreen(appState = appState)
                        MainTab.AGENDA -> ScheduleScreen(appState = appState)
                        MainTab.ANNOUNCEMENTS -> AnnouncementsScreen(appState = appState)
                        MainTab.MORE -> MoreScreen(appState = appState)
                    }
                }
            }
        }
    }
}
