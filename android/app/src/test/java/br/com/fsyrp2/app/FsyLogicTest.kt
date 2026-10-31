package br.com.fsyrp2.app

import br.com.fsyrp2.app.data.CardOrderManager
import br.com.fsyrp2.app.data.EventCalendar
import br.com.fsyrp2.app.data.EventPhase
import br.com.fsyrp2.app.model.*
import br.com.fsyrp2.app.security.DeepLinkParser
import br.com.fsyrp2.app.security.DeepLinkTarget
import br.com.fsyrp2.app.security.PkceAuthHelper
import kotlinx.serialization.json.Json
import org.junit.Assert.*
import org.junit.Test
import java.time.ZonedDateTime

class FsyLogicTest {

    private val json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
        encodeDefaults = true
    }

    @Test
    fun cardOrderManager_isolatesPerAccountAndResolvesDefaults() {
        val defaults = CardOrderManager.PAGE_DEFAULT_IDS["dashboard"]!!
        val customSaved = listOf("company", "next-activity", "unknown-id")
        val resolved = CardOrderManager.resolveOrder(defaults, customSaved)

        assertEquals(
            listOf("company", "next-activity", "announcements", "gallery"),
            resolved
        )

        val keyUserA = CardOrderManager.cacheKey("user-111", "dashboard")
        val keyUserB = CardOrderManager.cacheKey("user-222", "dashboard")
        assertTrue(CardOrderManager.isForeignLayoutKey(keyUserB, "user-111"))
        assertFalse(CardOrderManager.isForeignLayoutKey(keyUserA, "user-111"))

        val movedDown = CardOrderManager.moveBy(defaults, "next-activity", 1)
        assertEquals("next-activity", movedDown[1])
        assertEquals("announcements", movedDown[0])
    }

    @Test
    fun pkceAndDeepLinkParser_enforcesStrictAllowlist() {
        val verifier = PkceAuthHelper.generateCodeVerifier()
        val challenge = PkceAuthHelper.computeCodeChallengeS256(verifier)
        assertTrue(verifier.length >= 43)
        assertTrue(challenge.isNotBlank())
        assertFalse(challenge.contains("="))

        // Retorno OAuth PKCE sem state (padrão Supabase Redirect URL fsyrp2://auth-callback?code=...)
        val callbackNoState = DeepLinkParser.parse("fsyrp2://auth-callback?code=pkce_code_123")
        assertTrue(callbackNoState is DeepLinkTarget.AuthCallback)
        assertEquals("pkce_code_123", (callbackNoState as DeepLinkTarget.AuthCallback).code)

        // Link de anúncio via FCM push
        val uuid = "550e8400-e29b-41d4-a716-446655440000"
        val portalAnn = DeepLinkParser.parse("fsyrp2://portal/announcements/$uuid")
        assertTrue(portalAnn is DeepLinkTarget.Navigation)
        val nav = portalAnn as DeepLinkTarget.Navigation
        assertEquals(AppTab.AVISOS, nav.tab)
        assertEquals(uuid, nav.itemId)

        // Rejeita schemes externos, userInfo, fragmentos e path traversal
        assertNull(DeepLinkParser.parse("https://fsy-event-app.vercel.app/portal"))
        assertNull(DeepLinkParser.parse("fsyrp2://user@agenda"))
        assertNull(DeepLinkParser.parse("fsyrp2://agenda#frag"))
        assertNull(DeepLinkParser.parse("fsyrp2://portal/../secret"))
        assertNull(DeepLinkParser.parse("fsyrp2://portal/announcements/not-a-uuid"))
    }

    @Test
    fun eventCalendar_computesPhasesAndQuietHoursInSaoPauloZone() {
        val sampleSchedule = listOf(
            ScheduleItem(id = "0", day = "dia0", startTime = "09:00", endTime = "10:00", title = "Treinamento Equipe"),
            ScheduleItem(id = "1", day = "dia1", startTime = "08:00", endTime = "09:00", title = "Check-in"),
            ScheduleItem(id = "2", day = "dia1", startTime = "09:30", endTime = "10:30", title = "Devocional de Abertura")
        )

        val beforeEvent = ZonedDateTime.of(2026, 11, 1, 12, 0, 0, 0, EventCalendar.EVENT_ZONE)
        val mBefore = EventCalendar.moment(sampleSchedule, beforeEvent)
        assertEquals(EventPhase.BEFORE, mBefore.phase)
        assertEquals("dia1", mBefore.selectedDayKey)
        assertEquals("1", mBefore.nextItem?.id) // dia0 nunca entra como próxima atividade de jovem

        val duringActivity = ZonedDateTime.of(2027, 2, 6, 8, 30, 0, 0, EventCalendar.EVENT_ZONE)
        val mDuring = EventCalendar.moment(sampleSchedule, duringActivity)
        assertEquals(EventPhase.DURING, mDuring.phase)
        assertEquals("1", mDuring.currentItem?.id)
        assertEquals("2", mDuring.nextItem?.id)

        // Quiet hours cruzando meia-noite (22:30 -> 06:30)
        val lateNight = ZonedDateTime.of(2027, 2, 6, 23, 15, 0, 0, EventCalendar.EVENT_ZONE)
        val earlyMorning = ZonedDateTime.of(2027, 2, 7, 5, 45, 0, 0, EventCalendar.EVENT_ZONE)
        val midDay = ZonedDateTime.of(2027, 2, 7, 14, 0, 0, 0, EventCalendar.EVENT_ZONE)

        assertTrue(EventCalendar.isWithinQuietHours(lateNight, "22:30", "06:30"))
        assertTrue(EventCalendar.isWithinQuietHours(earlyMorning, "22:30", "06:30"))
        assertFalse(EventCalendar.isWithinQuietHours(midDay, "22:30", "06:30"))
    }

    @Test
    fun roleAndModuleGates_matchBackendPermissions() {
        assertFalse(AdminModule.ACCOUNTS.canAccess(UserRole.JOVEM, emptySet()))
        assertFalse(AdminModule.ACCOUNTS.canAccess(UserRole.CONSULTOR, emptySet()))
        assertTrue(AdminModule.INCLUSION.canAccess(UserRole.CONSULTOR, emptySet()))
        assertTrue(AdminModule.ANNOUNCEMENTS.canAccess(UserRole.CONSULTOR, emptySet()))
        assertFalse(AdminModule.REGISTRATIONS.canAccess(UserRole.CONSULTOR, emptySet()))

        // Gestores têm acesso aos 11 módulos
        for (mod in AdminModule.entries) {
            assertTrue(mod.canAccess(UserRole.COORDENADOR, emptySet()))
            assertTrue(mod.canAccess(UserRole.CASAL_DIRETOR, emptySet()))
            assertTrue(mod.canAccess(UserRole.LOGISTICA, emptySet()))
        }
    }

    @Test
    fun modelsAndPushBinding_deserializeContractPayloads() {
        val deviceJson = """
            {
              "id": "dev-row-1",
              "userId": "user-abc",
              "deviceId": "andr_userabc_999999999999",
              "platform": "android",
              "appVersion": "1.0.0",
              "bindingGeneration": 4,
              "hasActiveToken": true,
              "preferences": {
                "announcementsEnabled": true,
                "urgentOnly": false,
                "scheduleRemindersEnabled": true,
                "personalRemindersEnabled": true,
                "quietHoursStart": "22:30",
                "quietHoursEnd": "06:30"
              },
              "lastSeenAt": "2026-10-31T19:00:00Z",
              "updatedAt": "2026-10-31T19:00:00Z"
            }
        """.trimIndent()

        val summary = json.decodeFromString<RegisteredPushDeviceSummaryDto>(deviceJson)
        assertEquals("user-abc", summary.userId)
        assertEquals(4, summary.bindingGeneration)
        assertEquals("22:30", summary.preferences.quietHoursStart)
    }
}

