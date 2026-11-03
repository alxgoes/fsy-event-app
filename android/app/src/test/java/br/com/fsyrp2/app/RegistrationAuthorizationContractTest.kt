package br.com.fsyrp2.app

import br.com.fsyrp2.app.model.*
import br.com.fsyrp2.app.network.PortalApiClient
import br.com.fsyrp2.app.network.authorizationAdjustmentsRequestBody
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test
import java.net.ServerSocket
import java.time.LocalDate
import kotlin.concurrent.thread

class RegistrationAuthorizationContractTest {
    private val original = RegistrationRecordDto(
        id = "synthetic-registration", firstNameRaw = "Pessoa", lastNameRaw = "Fictícia",
        birthDateRaw = "data importada com aviso", cpfRaw = "inválido", phoneRaw = "16",
        sex = "sexo feminino", rawColumns = mapOf("firstName" to "Pessoa"),
        authorizationAdjustments = RegistrationAuthorizationAdjustmentsDto(
            values = mapOf("guardianName" to "Responsável Fictício"), editedByName = "Gestão Fictícia"
        ), hasAuthorizationAdjustments = true
    )

    @Test fun adjustmentProjectionPreservesOriginalAndSendsOnlyChangedFields() {
        val values = original.authorizationValues()
        assertEquals("Feminino", values["sex"])
        assertEquals("Responsável Fictício", values["guardianName"])
        assertEquals("inválido", values["cpf"])
        val changes = original.authorizationChanges(values + mapOf("guardianPhone" to "+55 (16) 99999-0000", "status" to "Aprovado"))
        assertEquals(mapOf("guardianPhone" to "+55 (16) 99999-0000"), changes)
        assertTrue(authorizationAdjustmentErrors(changes).isEmpty())
        assertEquals("Pessoa", original.firstNameRaw)
        assertEquals(mapOf("firstName" to "Pessoa"), original.rawColumns)
        assertEquals("inválido", original.cpfRaw)
        assertTrue(original.authorizationChanges(values).isEmpty())
        assertEquals(mapOf("guardianName" to ""), original.authorizationChanges(values + ("guardianName" to "")))
    }

    @Test fun validationChecksOnlyCorrectionsAndUsesPortalRules() {
        val today = LocalDate.of(2026, 11, 2)
        assertTrue(authorizationAdjustmentErrors(mapOf("birthDate" to "29/02/2012", "cpf" to "529.982.247-25", "phone" to "+55 (16) 99999-0000"), today).isEmpty())
        val invalid = authorizationAdjustmentErrors(mapOf("firstName" to "", "birthDate" to "29/02/2013", "cpf" to "111.111.111-11", "guardianPhone" to "99999-0000", "bishopEmail" to "sem-email"), today)
        assertEquals(setOf("firstName", "birthDate", "cpf", "guardianPhone", "bishopEmail"), invalid.keys)
        assertTrue("birthDate" in authorizationAdjustmentErrors(mapOf("birthDate" to "03/11/2026"), today))
        assertTrue(authorizationAdjustmentErrors(mapOf("birthDate" to "", "cpf" to "", "phone" to "", "bishopEmail" to ""), today).isEmpty())
        assertEquals("autorizacao-pessoa-ficticia.pdf", original.authorizationFilename())
        assertTrue(original.copy(status = "Cancelada").isCancelledRegistration())
    }

    @Test fun patchPayloadUsesOnlyAdjustmentsOrResetAndNeverSendsAuthorship() {
        val patch = Json.parseToJsonElement(authorizationAdjustmentsRequestBody(mapOf("guardianName" to "Conceição Fictícia", "guardianPhone" to ""), false)).jsonObject
        assertEquals(setOf("adjustments"), patch.keys)
        assertEquals(setOf("guardianName", "guardianPhone"), patch["adjustments"]!!.jsonObject.keys)
        assertEquals("", patch["adjustments"]!!.jsonObject["guardianPhone"]!!.jsonPrimitive.content)
        val reset = Json.parseToJsonElement(authorizationAdjustmentsRequestBody(mapOf("guardianName" to "ignorado"), true)).jsonObject
        assertEquals(setOf("resetAdjustments"), reset.keys)
        assertTrue(reset["resetAdjustments"]!!.jsonPrimitive.boolean)
    }

    @Test fun previewAndImportUseAuthenticatedPortalContract() = runTest {
        val server = ServerSocket(0)
        data class Request(val method: String, val path: String, val header: String, val body: String)
        val requests = mutableListOf<Request>()
        val worker = thread(isDaemon = true) {
            while (!server.isClosed) {
                val client = try { server.accept() } catch (_: Exception) { break }
                client.use {
                    val input = it.getInputStream()
                    val header = StringBuilder()
                    while (!header.endsWith("\r\n\r\n")) {
                        val next = input.read()
                        if (next < 0) return@use
                        header.append(next.toChar())
                    }
                    val first = header.lineSequence().first().split(' ')
                    val length = Regex("Content-Length: (\\d+)", RegexOption.IGNORE_CASE).find(header)?.groupValues?.get(1)?.toInt() ?: 0
                    val body = input.readNBytes(length).toString(Charsets.UTF_8)
                    synchronized(requests) { requests += Request(first[0], first[1], header.toString(), body) }
                    val response = if (first[1].contains("authorization-pdf")) "%PDF-synthetic" else "{}"
                    val bytes = response.toByteArray()
                    it.getOutputStream().apply {
                        write("HTTP/1.1 200 OK\r\nContent-Type: application/pdf\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray())
                        write(bytes); flush()
                    }
                }
            }
        }
        try {
            val base = "http://127.0.0.1:${server.localPort}"
            val api = PortalApiClient(base, "public-test", base)
            val session = UserSession("test-token", "test-refresh", userId = "synthetic-manager")
            assertEquals("%PDF-synthetic", api.previewAuthorizationPdf(session, original.id).toString(Charsets.UTF_8))
            assertEquals("GET", requests.last().method)
            assertTrue(requests.last().path.contains("download=0"))
            api.previewAuthorizationPdf(session, original.id, mapOf("guardianName" to "Conceição Fictícia"), false)
            val preview = requests.last()
            assertEquals("POST", preview.method)
            assertTrue(preview.header.contains("Authorization: Bearer test-token", ignoreCase = true))
            assertTrue(preview.path.contains("useNormalizedNames=false"))
            assertEquals("Conceição Fictícia", Json.parseToJsonElement(preview.body).jsonObject["adjustments"]!!.jsonObject["guardianName"]!!.jsonPrimitive.content)
            api.downloadAuthorizationPdf(session, original.id)
            assertEquals("GET", requests.last().method)
            assertFalse(requests.last().path.contains("download=0"))
            api.commitRegistrationsPreview(session, "synthetic-preview", "replace_all", 1, acknowledgeAdjustmentRemoval = true)
            val imported = Json.parseToJsonElement(requests.last().body).jsonObject
            assertTrue(imported["acknowledgeAdjustmentRemoval"]!!.jsonPrimitive.boolean)
            assertEquals("replace_all", imported["mode"]!!.jsonPrimitive.content)
        } finally {
            server.close(); worker.join(1000)
        }
    }
}
