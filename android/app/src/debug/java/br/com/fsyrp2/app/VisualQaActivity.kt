package br.com.fsyrp2.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.MutableState
import br.com.fsyrp2.app.model.*
import br.com.fsyrp2.app.network.PortalApiClient
import br.com.fsyrp2.app.state.FsyAppState
import br.com.fsyrp2.app.state.MainTab
import br.com.fsyrp2.app.state.OverlayDestination
import br.com.fsyrp2.app.ui.theme.FsyTheme

/** Synthetic visual QA only. This entire source set is absent from release. */
class VisualQaActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        check(BuildConfig.DEBUG)
        enableEdgeToEdge()
        val fixtureHost = intent.getStringExtra("fixture_host")
            ?.takeIf { it in setOf("10.0.2.2", "127.0.0.1") } ?: "10.0.2.2"
        val localApi = PortalApiClient(
            supabaseUrl = "http://$fixtureHost:8765",
            supabaseAnonKey = "synthetic-qa-not-a-key",
            portalBaseUrl = "http://$fixtureHost:8765",
        )
        val state = FsyAppState(applicationContext, apiClient = localApi)
        setFixture(state, "isOnline", true)
        val screen = intent.getStringExtra("screen") ?: "home"
        val role = intent.getStringExtra("role") ?: "jovem"
        val empty = intent.getBooleanExtra("empty", false)
        if (screen != "auth") {
            setFixture(state, "session", UserSession("synthetic-not-a-token", "", 4102444800L, "qa-youth", "exemplo@example.invalid"))
            setFixture(state, "profile", Profile("qa-youth", "Lia Exemplo", role, "qa-company", "Estaca Exemplo", "12"))
            setFixture(state, "company", Company("qa-company", "Companhia Girassol", "Juntos em Cristo", color = "#007DA5", youthCount = 24))
            setFixture(state, "companyYouth", listOf(Profile("qa-2", "Jovem Exemplo", "jovem", "qa-company", "Estaca Exemplo", "12")))
            setFixture(state, "scheduleItems", if (empty) emptyList() else listOf(
                ScheduleItem("qa-s1", "dia1", "2027-02-06", "Boas-vindas ao FSY", "09:00", "10:00", "Auditório", "Encontre sua companhia.", "Atividade", true),
                ScheduleItem("qa-s2", "dia1", "2027-02-06", "Almoço", "12:00", "13:00", "Restaurante", category = "Alimentação"),
                ScheduleItem("qa-s3", "dia1", "2027-02-06", "Conheça sua companhia", "14:00", "15:00", "Jardim", category = "Atividade"),
                ScheduleItem("qa-s4", "dia2", "2027-02-07", "Devocional", "09:00", "10:00", "Auditório", category = "Espiritual", isHighlight = true),
            ))
            setFixture(state, "announcements", if (empty) emptyList() else listOf(
                Announcement("qa-a1", "Bem-vindos ao FSY!", "Sua companhia espera por você no jardim. Vamos viver estes dias juntos!", category = "Geral", likesCount = 12, createdAt = "2027-02-06T08:00:00-03:00", profiles = AnnouncementAuthor("Equipe FSY", "coordenador")),
                Announcement("qa-a2", "Encontro no auditório", "Chegue 10 minutos antes da atividade.", priority = "important", category = "Agenda", createdAt = "2027-02-06T08:30:00-03:00"),
            ))
            setFixture(state, "lastSyncedAtLabel", "09:41")
            state.selectedTab = when (screen) {
                "agenda" -> MainTab.AGENDA
                "announcements" -> MainTab.ANNOUNCEMENTS
                "profile" -> MainTab.PROFILE
                else -> MainTab.HOME
            }
            state.overlayDestination = when (screen) {
                "admin" -> OverlayDestination.AdminHub(
                    AdminModule.entries.firstOrNull { it.id == intent.getStringExtra("module") }
                )
                "gallery" -> OverlayDestination.Gallery
                "counselor" -> OverlayDestination.CounselorPanel
                else -> OverlayDestination.None
            }
        }
        setContent { FsyTheme { FsyRootContent(state) } }
    }

    // Keep test injection out of production state/security APIs.
    @Suppress("UNCHECKED_CAST")
    private fun <T> setFixture(state: FsyAppState, property: String, value: T) {
        val field = FsyAppState::class.java.getDeclaredField(property + "$" + "delegate")
        field.isAccessible = true
        (field.get(state) as MutableState<T>).value = value
    }
}

/** Window host for rendering real RemoteViews with synthetic fixtures. Debug only. */
class WidgetQaHostActivity : ComponentActivity()
