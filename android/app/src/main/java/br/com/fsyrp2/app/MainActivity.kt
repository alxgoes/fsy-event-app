package br.com.fsyrp2.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.AnimatedContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Campaign
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import br.com.fsyrp2.app.state.FsyAppState
import br.com.fsyrp2.app.state.MainTab
import br.com.fsyrp2.app.state.OverlayDestination
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
private fun FsyRootContent(appState: FsyAppState) {
    val haptics = rememberFsyHaptics()
    val reduceMotion = fsyMotionPreferences().reduceMotion

    if (appState.isBootstrapping) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            CircularProgressIndicator()
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
            Scaffold(
                bottomBar = {
                    NavigationBar {
                        MainTab.entries.forEach { tab ->
                            val selected = appState.selectedTab == tab
                            val icon = when (tab) {
                                MainTab.HOME -> Icons.Default.Home
                                MainTab.AGENDA -> Icons.Default.CalendarMonth
                                MainTab.ANNOUNCEMENTS -> Icons.Default.Campaign
                                MainTab.PROFILE -> Icons.Default.Person
                            }
                            NavigationBarItem(
                                selected = selected,
                                onClick = {
                                    if (!selected) {
                                        haptics.tick()
                                        appState.selectedTab = tab
                                    }
                                },
                                icon = {
                                    Icon(
                                        imageVector = icon,
                                        contentDescription = tab.label
                                    )
                                },
                                label = {
                                    Text(
                                        text = tab.label,
                                        fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium
                                    )
                                }
                            )
                        }
                    }
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
