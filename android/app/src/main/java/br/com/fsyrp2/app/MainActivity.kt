package br.com.fsyrp2.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import br.com.fsyrp2.app.state.FsyAppState
import br.com.fsyrp2.app.state.MainTab
import br.com.fsyrp2.app.state.OverlayDestination
import br.com.fsyrp2.app.ui.components.FsyEventFacts
import br.com.fsyrp2.app.ui.components.FsyNavDestination
import br.com.fsyrp2.app.ui.components.FsyNavigationBar
import br.com.fsyrp2.app.ui.components.FsyTempleMark
import br.com.fsyrp2.app.ui.icons.FsyIcons
import br.com.fsyrp2.app.ui.motion.fsyContentSwap
import br.com.fsyrp2.app.ui.motion.fsyMotionPreferences
import br.com.fsyrp2.app.ui.motion.rememberFsyHaptics
import br.com.fsyrp2.app.ui.screens.*
import br.com.fsyrp2.app.ui.screens.admin.AdminHubScreen
import br.com.fsyrp2.app.ui.theme.FsyTheme

class MainActivity : ComponentActivity() {

    private lateinit var appState: FsyAppState

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        appState = FsyAppState(applicationContext)
        intent?.dataString?.let { appState.handleIncomingDeepLink(it) }

        setContent {
            FsyTheme {
                FsyRootContent(appState = appState)
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        intent.dataString?.let { appState.handleIncomingDeepLink(it) }
    }
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

    val overlay = appState.overlayDestination
    BackHandler(enabled = overlay != OverlayDestination.None) {
        appState.overlayDestination = OverlayDestination.None
    }

    when (overlay) {
        is OverlayDestination.Gallery -> GalleryScreen(appState = appState)
        is OverlayDestination.CounselorPanel -> CounselorScreen(appState = appState)
        is OverlayDestination.AdminHub -> AdminHubScreen(
            appState = appState,
            initialModule = overlay.initialModule
        )
        OverlayDestination.None -> {
            val tabs = MainTab.entries
            val destinations = tabs.map { tab ->
                FsyNavDestination(
                    label = tab.label,
                    icon = when (tab) {
                        MainTab.HOME -> FsyIcons.LayoutDashboard
                        MainTab.AGENDA -> FsyIcons.CalendarDays
                        MainTab.ANNOUNCEMENTS -> FsyIcons.Megaphone
                        MainTab.PROFILE -> FsyIcons.UserRound
                    }
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
                                haptics.tick()
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
                        when (currentTab) {
                            MainTab.HOME -> HomeScreen(appState = appState)
                            MainTab.AGENDA -> ScheduleScreen(appState = appState)
                            MainTab.ANNOUNCEMENTS -> AnnouncementsScreen(appState = appState)
                            MainTab.PROFILE -> ProfileScreen(appState = appState)
                        }
                    }
                }
            }
        }
    }
}
