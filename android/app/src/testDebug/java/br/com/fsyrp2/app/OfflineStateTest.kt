package br.com.fsyrp2.app

import android.content.Context
import androidx.compose.runtime.MutableState
import androidx.lifecycle.ViewModelProvider
import androidx.test.core.app.ApplicationProvider
import br.com.fsyrp2.app.data.OfflineCache
import br.com.fsyrp2.app.model.*
import br.com.fsyrp2.app.network.PortalApiClient
import br.com.fsyrp2.app.state.FsyAppState
import br.com.fsyrp2.app.state.FsyAppViewModel
import br.com.fsyrp2.app.state.MainTab
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import android.os.Looper
import java.time.Duration

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class OfflineStateTest {
    @Before fun initializeWorkManager() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        runCatching { androidx.work.WorkManager.initialize(context, androidx.work.Configuration.Builder().setMinimumLoggingLevel(android.util.Log.ERROR).build()) }
    }

    @Test fun offlineSnapshotSurvivesNewStoreAndIsErasedOnLogout() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val snapshot = OfflineSnapshot("qa-offline", profile = Profile("qa-offline", "Pessoa Exemplo"),
            scheduleItems = listOf(ScheduleItem("s", "dia1", title = "Abertura", startTime = "09:00")))
        OfflineCache(context).save(snapshot)
        assertEquals(snapshot, OfflineCache(context).load("qa-offline"))
        assertNull(OfflineCache(context).load("outra-conta"))
        val state = FsyAppState(context)
        state.signOut()
        assertNull(OfflineCache(context).load("qa-offline"))
        state.dispose()
    }

    @Test fun failedProfileDoesNotDiscardScheduleOrAnnouncements() {
        VisualFixtures(mapOf(
            "/rest/v1/profiles" to "[]",
            "/rest/v1/schedule_items" to """[{"id":"fresh","day":"dia1","title":"Agenda nova","start_time":"09:00"}]""",
            "/api/announcements" to """{"data":[{"id":"fresh-notice","title":"Aviso novo","content":"Mensagem"}]}""",
        )).use { fixtures ->
            val base = "http://127.0.0.1:${fixtures.port}"
            val state = FsyAppState(ApplicationProvider.getApplicationContext(), PortalApiClient(base, "test", base))
            setFixture(state, "session", UserSession("synthetic-token", "", 4102444800L, "qa-offline"))
            state.refreshCoreData()
            val deadline = System.nanoTime() + 10_000_000_000L
            do {
                shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(50))
                if (state.rawScheduleItems.isNotEmpty() && !state.isLoading) break
                Thread.sleep(10)
            } while (System.nanoTime() < deadline)
            assertEquals("Agenda nova", state.scheduleItems.single().title)
            assertEquals("Aviso novo", state.announcements.single().title)
            assertNull(state.profile)
            assertFalse(state.canOpenAdmin)
            assertNotNull(state.globalBannerError)
            state.signOut()
            state.dispose()
        }
    }

    @Test fun viewModelRetainsSelectedTabAfterActivityRecreation() {
        val controller = Robolectric.buildActivity(MainActivity::class.java).setup()
        val before = ViewModelProvider(controller.get())[FsyAppViewModel::class.java]
        before.state.selectedTab = MainTab.MORE
        setFixture(before.state, "profile", Profile("qa-manager", "Gestão Fictícia", "coordenador"))
        before.state.editRegistrationAuthorization(RegistrationRecordDto("qa-registration", firstNameRaw = "Pessoa"))
        before.state.updateRegistrationAuthorizationField("guardianName", "Responsável Fictício")
        controller.recreate()
        val after = ViewModelProvider(controller.get())[FsyAppViewModel::class.java]
        assertSame(before, after)
        assertEquals(MainTab.MORE, after.state.selectedTab)
        assertEquals("Responsável Fictício", after.state.registrationAuthorizationEditor?.draft?.get("guardianName"))
        after.state.signOut()
        assertNull(after.state.registrationAuthorizationEditor)
        controller.pause().stop().destroy()
    }

    @Test fun privateDocumentsExpireAndLogoutErasesRemainingFiles() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val directory = java.io.File(context.cacheDir, "documents").apply { mkdirs() }
        val oldFile = java.io.File(directory, "old-synthetic.pdf").apply {
            writeText("synthetic fixture")
            setLastModified(System.currentTimeMillis() - 16 * 60 * 1000L)
        }
        val recentFile = java.io.File(directory, "recent-synthetic.pdf").apply { writeText("synthetic fixture") }
        br.com.fsyrp2.app.ui.components.ExternalUrlLauncher.purgeExpiredPrivateDocuments(context)
        assertFalse(oldFile.exists())
        assertTrue(recentFile.exists())
        val state = FsyAppState(context)
        state.signOut()
        assertFalse(recentFile.exists())
        state.dispose()
    }

    @Suppress("UNCHECKED_CAST")
    private fun <T> setFixture(state: FsyAppState, property: String, value: T) {
        val field = FsyAppState::class.java.getDeclaredField(property + "$" + "delegate")
        field.isAccessible = true
        (field.get(state) as MutableState<T>).value = value
    }
}
