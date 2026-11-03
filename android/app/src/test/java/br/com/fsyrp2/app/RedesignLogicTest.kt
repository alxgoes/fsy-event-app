package br.com.fsyrp2.app

import br.com.fsyrp2.app.data.EventCalendar
import br.com.fsyrp2.app.model.*
import br.com.fsyrp2.app.network.FriendlyErrors
import kotlinx.serialization.json.Json
import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class RedesignLogicTest {
    @Test fun youthAndUnknownRoleFilterEveryStaffCategory() {
        val items = listOf(
            ScheduleItem("zero", "dia0", title = "Preparação", startTime = "08:00"),
            ScheduleItem("staff", "dia1", title = "Reservado", startTime = "09:00", category = "Equipe"),
            ScheduleItem("legacy", "dia1", title = "Reservado antigo", startTime = "09:30", category = "staff"),
            ScheduleItem("legacy-preparation", "dia1", title = "Preparação para receber os jovens", startTime = "08:00", category = "Logística"),
            ScheduleItem("public", "dia1", title = "Almoço", startTime = "12:00", category = "Alimentação"),
            ScheduleItem("public-logistics", "dia1", title = "Saída dos ônibus", startTime = "17:00", category = "Logística"),
        )
        for (role in listOf(null, UserRole.JOVEM, UserRole.fromWire("cargo inválido"))) {
            assertEquals(listOf("public", "public-logistics"), ScheduleVisibility.visibleTo(items, role).map { it.id })
        }
        assertEquals(items, ScheduleVisibility.visibleTo(items, UserRole.CONSULTOR))
    }

    @Test fun categoriesTimesAndPasswordUsePublishedRules() {
        for (category in ScheduleDays.categories) assertEquals(category, ScheduleDays.normalizeCategory(category))
        assertEquals("Alimentação", ScheduleDays.normalizeCategory("meal"))
        assertEquals("Espiritual", ScheduleDays.normalizeCategory("spiritual"))
        assertTrue(ScheduleDays.validTimes("08:00", "09:30"))
        for ((start, end) in listOf("8:00" to "09:00", "24:00" to "25:00", "10:00" to "09:00", "12:60" to "13:00")) {
            assertFalse(ScheduleDays.validTimes(start, end))
        }
        assertNotNull(PasswordPolicy.validate("abcdefgh"))
        assertNotNull(PasswordPolicy.validate("12345678"))
        assertNull(PasswordPolicy.validate("BomDia2027"))
        assertFalse(NotificationChannelPreferencesDto().scheduleRemindersEnabled)
    }

    @Test fun missingEndUsesNextStartAndKeepsGapHonest() {
        val items = listOf(
            ScheduleItem("one", "dia1", title = "Abertura", startTime = "09:00"),
            ScheduleItem("two", "dia1", title = "Almoço", startTime = "12:00", endTime = "13:00"),
            ScheduleItem("three", "dia1", title = "Encontro", startTime = "14:00", endTime = "15:00"),
        )
        assertEquals("one", EventCalendar.moment(items, Instant.parse("2027-02-06T13:00:00Z")).currentItem?.id)
        val gap = EventCalendar.moment(items, Instant.parse("2027-02-06T16:30:00Z"))
        assertNull(gap.currentItem)
        assertEquals("three", gap.nextItem?.id)
    }

    @Test fun realProfileFieldsAndPhotoContractDecode() {
        val json = Json { ignoreUnknownKeys = true }
        val profile = json.decodeFromString<Profile>("""{"id":"x","room":"12","bus_assignment":"Azul","stake":"Estaca"}""")
        assertEquals("12", profile.room)
        assertEquals("Azul", profile.busAssignment)
        val company = json.decodeFromString<Company>("""{"id":"c","name":"Girassol","room":"Sala A","drive_url":"https://drive.google.com/example"}""")
        assertEquals("Sala A", company.room)
        assertTrue(company.driveUrl!!.startsWith("https://"))
        val pending = json.decodeFromString<ProfilePhotoState>("""{"status":"pending","pending_url":"https://example.invalid/pending","approved_url":null}""")
        assertTrue(pending.isPending)
        assertNull(pending.approvedUrl)
        assertEquals("https://example.invalid/pending", pending.pendingUrl)
    }

    @Test fun technicalErrorsAreNeverDisplayed() {
        assertEquals("Sua sessão terminou. Entre novamente.", FriendlyErrors.message("invalid_grant", 400))
        assertEquals("E-mail ou senha incorretos.", FriendlyErrors.message("Invalid login credentials", 400))
        assertEquals("Escolha outra foto.", FriendlyErrors.message("Escolha outra foto.", 400))
        assertFalse(FriendlyErrors.message("HTTP 500 Internal Server Error", 500).contains("HTTP"))
    }
}
