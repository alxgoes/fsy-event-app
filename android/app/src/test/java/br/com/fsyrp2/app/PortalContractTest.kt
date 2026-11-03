package br.com.fsyrp2.app

import br.com.fsyrp2.app.model.*
import br.com.fsyrp2.app.network.PortalApiClient
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test
import java.net.ServerSocket
import kotlin.concurrent.thread

class PortalContractTest {
    @Test
    fun accountAndInclusionRoutes_followPublishedWebContract() = runTest {
        val requests = mutableListOf<Triple<String, String, String>>()
        val server = ServerSocket(0)
        val worker = thread(isDaemon = true) {
          while (!server.isClosed) {
            val socket = try { server.accept() } catch (_: Exception) { break }
            socket.use {
            val reader = socket.getInputStream().bufferedReader()
            val request = reader.readLine().split(" ")
            val method = request[0]
            val path = request[1]
            var length = 0
            while (true) {
                val header = reader.readLine() ?: break
                if (header.isEmpty()) break
                if (header.startsWith("Content-Length:", true)) length = header.substringAfter(":").trim().toInt()
            }
            val content = CharArray(length)
            var read = 0
            while (read < length) { val count = reader.read(content, read, length - read); if (count < 0) break; read += count }
            val body = String(content, 0, read)
            synchronized(requests) { requests.add(Triple(method, path, body)) }
            val response = when {
                path.startsWith("/api/admin/accounts?") -> """{"data":[{"id":"synthetic","full_name":"Pessoa de Teste","role":"jovem","status":"ativo"}],"total":26,"page":1,"per_page":25,"permissions":{}}"""
                path == "/api/inclusion/synthetic" -> """{"data":{"id":"synthetic","full_name":"Pessoa de Teste","phase":"triagem","version":2,"interviews":[{"id":"interview","participants":"Equipe de Teste","status":"realizada","summary":"Registro sintético"}]}}"""
                path == "/api/admin/accounts/synthetic" && method == "GET" -> """{"data":[{"id":"event","actor_name":"Equipe de Teste","action":"edit"}]}"""
                else -> """{"success":true}"""
            }.toByteArray()
            socket.getOutputStream().apply {
                write("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${response.size}\r\nConnection: close\r\n\r\n".toByteArray())
                write(response)
                flush()
            }
            }
          }
        }
        try {
            val base = "http://127.0.0.1:${server.localPort}"
            val client = PortalApiClient(base, "public-test", base)
            val session = UserSession("synthetic-token", "synthetic-refresh", userId = "synthetic")
            val accounts = client.fetchAdminAccounts(session, search = "Pessoa", pageSize = 25)
            assertEquals("Pessoa de Teste", accounts.accounts.single().fullName)
            assertEquals(2, accounts.totalPages)
            assertTrue(requests.first().second.contains("per_page=25"))
            assertTrue(requests.first().second.contains("q=Pessoa"))
            assertEquals("Equipe de Teste", client.fetchAccountEvents(session, "synthetic").single().actorName)
            client.sendAccountRecovery(session, "synthetic")
            client.sendAccountEmail(session, "synthetic", "Assunto de teste", "Mensagem de teste.")
            val mail = requests.last()
            assertEquals("/api/admin/accounts/synthetic/email", mail.second)
            assertTrue(Json.parseToJsonElement(mail.third).jsonObject["confirm"]!!.jsonPrimitive.boolean)
            assertTrue(requests.any { it.second == "/api/admin/accounts/synthetic/recovery" })
            val (detail, interviews) = client.fetchInclusionCaseDetail(session, "synthetic")
            assertEquals(2, detail.version)
            assertEquals("Pessoa de Teste", detail.participantName)
            assertEquals("Equipe de Teste", interviews.single().participants)
        } finally {
            server.close()
            worker.join(1000)
        }
    }

    @Test
    fun decodedFields_matchRealScheduleAnnouncementAndRegistrationPayloads() {
        val json = Json { ignoreUnknownKeys = true }
        val schedule = json.decodeFromString<ScheduleItem>("""{"id":"activity","day":"dia2","title":"Atividade de Teste","start_time":"09:00"}""")
        assertEquals("dia2", schedule.dayKey)
        val announcement = json.decodeFromString<Announcement>("""{"id":"notice","title":"Aviso","content":"Teste","priority":"urgent","target_company_id":"cia-1","profiles":{"full_name":"Equipe"}}""")
        assertTrue(announcement.isUrgent)
        assertEquals("cia-1", announcement.companyId)
        assertEquals("Equipe", announcement.author?.fullName)
        assertFalse(AdminModule.ACCOUNTS.canAccess(UserRole.CONSULTOR, setOf("users")))
        assertTrue(AdminModule.MEDICAL.canAccess(UserRole.MEDICO, emptySet()))
    }
}


