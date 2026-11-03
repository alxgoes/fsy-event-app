package br.com.fsyrp2.app

import android.content.Context
import android.os.Looper
import androidx.compose.runtime.MutableState
import androidx.test.core.app.ApplicationProvider
import br.com.fsyrp2.app.data.OfflineCache
import br.com.fsyrp2.app.model.*
import br.com.fsyrp2.app.network.PortalApiClient
import br.com.fsyrp2.app.security.KeystoreSessionStore
import br.com.fsyrp2.app.state.FsyAppState
import br.com.fsyrp2.app.state.MainTab
import br.com.fsyrp2.app.state.OverlayDestination
import kotlinx.coroutines.*
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import java.time.Duration

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class ProfileAccessRefreshTest {
    private val context: Context get() = ApplicationProvider.getApplicationContext()
    private val userId = "synthetic-manager"

    @Before fun prepare() {
        KeystoreSessionStore(context).clearSession()
        OfflineCache(context).clearAll()
        runCatching { androidx.work.WorkManager.initialize(context, androidx.work.Configuration.Builder().setMinimumLoggingLevel(android.util.Log.ERROR).build()) }
    }

    private fun state(fixtures: VisualFixtures): FsyAppState {
        val base = "http://127.0.0.1:${fixtures.port}"
        return FsyAppState(context, PortalApiClient(base, "public-test", base)).also { state ->
            setFixture(state, "session", UserSession("synthetic-token", "", 4102444800L, userId))
            setFixture(state, "profile", Profile(userId, "Gestão Fictícia", "logistica", companyId = "synthetic-company"))
            setFixture(state, "companyYouth", listOf(Profile("synthetic-youth", "Jovem Fictício")))
            setFixture(state, "photoReviews", listOf(ProfilePhotoReview("synthetic-youth", "Jovem Fictício")))
            setFixture(state, "companyProfilePhotos", mapOf("synthetic-youth" to "https://example.invalid/photo"))
            setFixture(state, "rawScheduleItems", listOf(
                ScheduleItem("staff-zero", "dia0", title = "Preparação reservada", startTime = "08:00"),
                ScheduleItem("staff-team", "dia1", title = "Reunião reservada", startTime = "09:00", category = "Equipe"),
                ScheduleItem("public", "dia1", title = "Abertura", startTime = "10:00")
            ))
        }
    }

    private fun refresh(state: FsyAppState) {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
        val job = scope.launch { state.refreshProfileAccess() }
        try {
            val deadline = System.nanoTime() + 10_000_000_000L
            while (!job.isCompleted && System.nanoTime() < deadline) {
                shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(25))
                Thread.sleep(10)
            }
            assertTrue("A revalidação leve precisa terminar", job.isCompleted)
        } finally { scope.cancel() }
    }

    @Test fun roleChangeToYouthClosesManagementAndClearsPrivateStateWithoutRelogin() {
        VisualFixtures(mapOf(
            "/rest/v1/profiles" to """[{"id":"$userId","full_name":"Pessoa Fictícia","role":"jovem","company_id":"synthetic-company"}]"""
        )).use { fixtures ->
            val state = state(fixtures)
            state.open(OverlayDestination.AdminHub(AdminModule.REGISTRATIONS))
            state.editRegistrationAuthorization(RegistrationRecordDto("synthetic-registration", firstNameRaw = "Pessoa"))
            assertTrue(state.canOpenAdmin)
            assertNotNull(state.registrationAuthorizationEditor)
            refresh(state)
            assertEquals(UserRole.JOVEM, state.effectiveRole)
            assertNotNull(state.session)
            assertFalse(state.canOpenAdmin)
            assertFalse(state.canOpenCounselorPanel)
            assertEquals(OverlayDestination.None, state.overlayDestination)
            assertEquals(MainTab.HOME, state.selectedTab)
            assertFalse(state.scheduleItems.any { ScheduleVisibility.isStaffOnly(it) })
            assertTrue(state.companyYouth.isEmpty())
            assertTrue(state.photoReviews.isEmpty())
            assertTrue(state.companyProfilePhotos.isEmpty())
            assertNull(state.registrationAuthorizationEditor)
            assertEquals("jovem", OfflineCache(context).load(userId)?.profile?.role)
            state.dispose()
        }
    }

    @Test fun transientProfileFailurePreservesCurrentScreenAndKnownData() {
        VisualFixtures(mapOf("/rest/v1/profiles" to "temporariamente indisponível")).use { fixtures ->
            val state = state(fixtures)
            state.open(OverlayDestination.CounselorPanel)
            val oldProfile = state.profile
            val oldSchedule = state.scheduleItems
            refresh(state)
            assertSame(oldProfile, state.profile)
            assertEquals(oldSchedule, state.scheduleItems)
            assertEquals(OverlayDestination.CounselorPanel, state.overlayDestination)
            assertTrue(state.companyYouth.isNotEmpty())
            assertNull(state.globalBannerError)
            state.dispose()
        }
    }

    @Test fun suspendedProfileEndsSessionAndErasesPrivilegedData() {
        VisualFixtures(mapOf(
            "/rest/v1/profiles" to """[{"id":"$userId","full_name":"Pessoa Fictícia","role":"logistica","suspended_at":"2026-11-02T12:00:00Z"}]"""
        )).use { fixtures ->
            val state = state(fixtures)
            state.open(OverlayDestination.CounselorPanel)
            refresh(state)
            assertNull(state.session)
            assertNull(state.profile)
            assertEquals(OverlayDestination.None, state.overlayDestination)
            assertTrue(state.companyYouth.isEmpty())
            assertTrue(state.photoReviews.isEmpty())
            assertTrue(state.companyProfilePhotos.isEmpty())
            state.dispose()
        }
    }

    @Suppress("UNCHECKED_CAST")
    private fun <T> setFixture(state: FsyAppState, property: String, value: T) {
        val field = FsyAppState::class.java.getDeclaredField(property + "$" + "delegate")
        field.isAccessible = true
        (field.get(state) as MutableState<T>).value = value
    }
}
