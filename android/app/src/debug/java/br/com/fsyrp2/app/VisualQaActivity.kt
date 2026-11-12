package br.com.fsyrp2.app

import android.os.Bundle
import androidx.compose.ui.graphics.asImageBitmap
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
    lateinit var state: FsyAppState
    override fun onDestroy() { state.dispose(); super.onDestroy() }
    @OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        check(BuildConfig.DEBUG)
        enableEdgeToEdge()
        val fixtureHost = intent.getStringExtra("fixture_host")
            ?.takeIf { it in setOf("10.0.2.2", "127.0.0.1") } ?: "10.0.2.2"
        val port = intent.getIntExtra("fixture_port", 8765)
        val localApi = PortalApiClient(
            supabaseUrl = "http://$fixtureHost:$port",
            supabaseAnonKey = "synthetic-qa-not-a-key",
            portalBaseUrl = "http://$fixtureHost:$port",
        )
        state = FsyAppState(applicationContext, apiClient = localApi)
        setFixture(state, "isOnline", true)
        val screen = intent.getStringExtra("screen") ?: "home"
        val role = intent.getStringExtra("role") ?: "jovem"
        val empty = intent.getBooleanExtra("empty", false)
        if (screen != "auth") {
            setFixture(state, "session", UserSession("synthetic-not-a-token", "", 4102444800L, "qa-youth", "exemplo@example.invalid"))
            if (role != "loading") setFixture(state, "profile", Profile("qa-youth", "Lia Exemplo", role, "qa-company", "Estaca Exemplo", "12"))
            setFixture(state, "company", Company("qa-company", "Companhia Girassol", "Juntos em Cristo", color = "#007DA5", counselors = listOf("Ana Exemplo", "Paulo Exemplo"), youthCount = 24))
            setFixture(state, "companyYouth", listOf(Profile("qa-2", "Jovem Exemplo", "jovem", "qa-company", "Estaca Exemplo", "12")))
            setFixture(state, "rawScheduleItems", if (empty) emptyList() else listOf(
                ScheduleItem("qa-s1", "dia1", "2027-02-06", "Boas-vindas ao FSY", "09:00", "10:00", "Auditório", "Encontre sua companhia.", "Atividade", true),
                ScheduleItem("qa-s2", "dia1", "2027-02-06", "Almoço", "12:00", "13:00", "Restaurante", category = "Alimentação"),
                ScheduleItem("qa-s3", "dia1", "2027-02-06", "Conheça sua companhia", "14:00", "15:00", "Jardim", category = "Atividade"),
                ScheduleItem("qa-staff", "dia1", "2027-02-06", "Reunião reservada", "10:00", "11:00", "Sala", category = "Equipe"),
                ScheduleItem("qa-day0", "dia0", "2027-02-05", "Preparação reservada", "10:00", "11:00", "Sala", category = "Equipe"),
                ScheduleItem("qa-legacy-preparation", "dia1", "2027-02-06", "Preparação interna antiga", "08:00", "09:00", "Sala", category = "Logística"),
                ScheduleItem("qa-s4", "dia2", "2027-02-07", "Devocional", "09:00", "10:00", "Auditório", category = "Espiritual", isHighlight = true),
            ))
            setFixture(state, "announcements", if (empty) emptyList() else listOf(
                Announcement("qa-a1", "Bem-vindos ao FSY!", "Sua companhia espera por você no jardim. Vamos viver estes dias juntos!", category = "Geral", likesCount = 12, createdAt = "2027-02-06T08:00:00-03:00", profiles = AnnouncementAuthor("Equipe FSY", "coordenador")),
                Announcement("qa-a2", "Encontro no auditório", "Chegue 10 minutos antes da atividade.", priority = "important", category = "Agenda", createdAt = "2027-02-06T08:30:00-03:00"),
            ))
            setFixture(state, "lastSyncedAtLabel", "09:41")
            br.com.fsyrp2.app.ui.components.FsyClock.override = java.time.Instant.parse(intent.getStringExtra("clock") ?: "2027-02-06T12:30:00Z")
            if (intent.getBooleanExtra("pending_photo", false)) setFixture(state, "profilePhoto", ProfilePhotoState(status = "pending", pendingUrl = "http://$fixtureHost:$port/qa/photo.png"))
            if (intent.getBooleanExtra("approved_photo", false)) setFixture(state, "profilePhoto", ProfilePhotoState(status = "approved", approvedUrl = "http://$fixtureHost:$port/qa/photo.png"))
            if (intent.hasExtra("whatsapp_url")) {
                val rawWhatsapp = intent.getStringExtra("whatsapp_url")?.takeIf { it.isNotBlank() }
                setFixture(
                    state,
                    "companyWhatsapp",
                    CompanyWhatsappLink(
                        companyId = "qa-company",
                        companyName = "Companhia Girassol",
                        inviteUrl = rawWhatsapp,
                        canEdit = role != "jovem",
                        updatedAt = if (rawWhatsapp != null) "2027-02-06T09:00:00Z" else null,
                        updatedByName = if (rawWhatsapp != null) "Ana Exemplo" else null,
                        hasCounselor = true,
                    ),
                )
            }
            if (role != "jovem") setFixture(state, "photoReviews", listOf(ProfilePhotoReview("qa-2", "Jovem Exemplo", "qa-company", "Companhia Girassol", "http://$fixtureHost:$port/qa/photo.png")))
            val fixtureBitmap = android.graphics.Bitmap.createBitmap(512, 512, android.graphics.Bitmap.Config.ARGB_8888)
            android.graphics.Canvas(fixtureBitmap).apply {
                drawColor(android.graphics.Color.rgb(0, 125, 165))
                val paint = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG)
                paint.color = android.graphics.Color.rgb(255, 228, 138)
                drawCircle(355f, 130f, 72f, paint)
                paint.color = android.graphics.Color.rgb(0, 94, 124)
                drawPath(android.graphics.Path().apply { moveTo(0f, 420f); lineTo(170f, 175f); lineTo(420f, 512f); lineTo(0f, 512f); close() }, paint)
                paint.color = android.graphics.Color.rgb(252, 78, 109)
                drawCircle(410f, 435f, 145f, paint)
            }
            val image = fixtureBitmap.asImageBitmap()
            (listOf("http://$fixtureHost:$port/qa/photo.png") + (1..9).map { "http://$fixtureHost:$port/qa/photo.png?i=$it" }).forEach {
                br.com.fsyrp2.app.ui.components.RemoteImageMemory.put(it, image)
            }
            if (!empty) {
                setFixture(state, "instagramPosts", (1..9).map { InstagramPost("qa-photo-$it", "http://$fixtureHost:$port/qa/photo.png?i=$it", "Recordação da sessão $it") })
            }
            state.selectedTab = when (screen) {
                "agenda" -> MainTab.AGENDA
                "announcements" -> MainTab.ANNOUNCEMENTS
                "profile", "more" -> MainTab.MORE
                else -> MainTab.HOME
            }
            state.open(when (screen) {
                "admin" -> OverlayDestination.AdminHub(
                    AdminModule.entries.firstOrNull { it.id == intent.getStringExtra("module") }
                )
                "gallery" -> OverlayDestination.Gallery
                "counselor" -> OverlayDestination.CounselorPanel
                "notifications" -> OverlayDestination.NotificationSettings
                else -> OverlayDestination.None
            })
        }
        setContent { FsyTheme {
            if (intent.getBooleanExtra("disable_native_ripple", false)) {
                androidx.compose.runtime.CompositionLocalProvider(androidx.compose.material3.LocalRippleConfiguration provides null) { FsyRootContent(state) }
            } else FsyRootContent(state)
        } }
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
