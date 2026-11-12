package br.com.fsyrp2.app

import br.com.fsyrp2.app.model.UserSession
import br.com.fsyrp2.app.model.UserRole
import br.com.fsyrp2.app.model.ProfilePhotoState
import br.com.fsyrp2.app.model.CompanyWhatsappLink
import br.com.fsyrp2.app.model.WhatsappInviteValidator
import br.com.fsyrp2.app.model.normalizeWhatsappInvite
import br.com.fsyrp2.app.network.ApiException
import br.com.fsyrp2.app.network.FriendlyErrors
import br.com.fsyrp2.app.network.PortalApiClient
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test
import java.net.ServerSocket
import kotlin.concurrent.thread

class ProfilePhotoContractTest {
    @Test fun onlyYouthRequiresPhotoApprovalAndUploadFeedbackFollowsTheResponse() {
        assertTrue(UserRole.JOVEM.requiresProfilePhotoApproval)
        assertTrue(UserRole.fromWire("cargo_desconhecido").requiresProfilePhotoApproval)
        val pending = ProfilePhotoState(status = "pending", pendingUrl = "https://example.invalid/pending")
        val approved = ProfilePhotoState(status = "approved", approvedUrl = "https://example.invalid/approved")
        assertEquals("Foto enviada para análise do seu consultor.", pending.uploadMessageFor(UserRole.JOVEM))
        UserRole.entries.filter { it != UserRole.JOVEM }.forEach { role ->
            assertFalse(role.requiresProfilePhotoApproval)
            assertEquals("Foto atualizada.", approved.uploadMessageFor(role))
            assertFalse(pending.uploadMessageFor(role).orEmpty().contains("consultor"))
        }
    }

    @Test fun portalApprovedResponseIsUsedImmediatelyForEveryNonYouthRole() = runTest {
        val server = ServerSocket(0)
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
                    val length = Regex("Content-Length: (\\d+)", RegexOption.IGNORE_CASE).find(header)?.groupValues?.get(1)?.toInt() ?: 0
                    input.readNBytes(length)
                    val response = """{"status":"approved","approved_url":"https://example.invalid/approved","pending_url":null,"review_note":null}""".toByteArray()
                    it.getOutputStream().apply {
                        write("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${response.size}\r\nConnection: close\r\n\r\n".toByteArray())
                        write(response); flush()
                    }
                }
            }
        }
        try {
            val base = "http://127.0.0.1:${server.localPort}"
            val api = PortalApiClient(base, "public-test", base)
            for (role in UserRole.entries.filter { it != UserRole.JOVEM }) {
                val result = api.uploadProfilePhoto(UserSession("synthetic-${role.wireValue}", "", userId = "synthetic-staff"), byteArrayOf(-1, -40, -1, 0))
                assertEquals("approved", result.status)
                assertEquals("https://example.invalid/approved", result.approvedUrl)
                assertNull(result.pendingUrl)
                assertFalse(result.isPending)
            }
        } finally { server.close(); worker.join(1000) }
    }

    @Test fun photoLifecycleAndSignupFollowPortalContract() = runTest {
        val server = ServerSocket(0)
        val requests = mutableListOf<Triple<String, String, String>>()
        val worker = thread(isDaemon = true) {
            while (!server.isClosed) {
                val client = try { server.accept() } catch (_: Exception) { break }
                client.use {
                    val input = it.getInputStream()
                    val header = StringBuilder()
                    while (!header.endsWith("\r\n\r\n")) {
                        val byte = input.read()
                        if (byte < 0) return@use
                        header.append(byte.toChar())
                    }
                    val first = header.lineSequence().first().split(' ')
                    val length = Regex("Content-Length: (\\d+)", RegexOption.IGNORE_CASE).find(header)?.groupValues?.get(1)?.toInt() ?: 0
                    val body = input.readNBytes(length).toString(Charsets.ISO_8859_1)
                    synchronized(requests) { requests.add(Triple(first[0], first[1], body)) }
                    val photo = """{"status":"pending","pending_url":"https://example.invalid/pending","approved_url":null,"review_note":null}"""
                    val response = when {
                        first[1].contains("/auth/v1/signup") -> """{"user":{"id":"synthetic"}}"""
                        first[1].endsWith("/reviews") && first[0] == "GET" -> """{"data":[{"user_id":"synthetic","full_name":"Pessoa","pending_url":"https://example.invalid/pending"}]}"""
                        first[1].endsWith("/company") -> """{"data":{"synthetic":"https://example.invalid/approved"}}"""
                        first[1].endsWith("/reviews") -> """{"success":true}"""
                        else -> photo
                    }.toByteArray()
                    it.getOutputStream().apply {
                        write("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${response.size}\r\nConnection: close\r\n\r\n".toByteArray())
                        write(response); flush()
                    }
                }
            }
        }
        try {
            val base = "http://127.0.0.1:${server.localPort}"
            val api = PortalApiClient(base, "public-test", base)
            val session = UserSession("test-token", "test-refresh", userId = "synthetic")
            assertTrue(api.fetchProfilePhoto(session).isPending)
            assertTrue(api.uploadProfilePhoto(session, byteArrayOf(-1, -40, -1, 0)).isPending)
            val upload = requests.last()
            assertEquals("POST", upload.first)
            assertTrue(upload.third.contains("name=\"file\""))
            assertTrue(upload.third.contains("Content-Type: image/jpeg"))
            api.deleteProfilePhoto(session, "pending")
            assertTrue(requests.last().second.endsWith("?scope=pending"))
            api.deleteProfilePhoto(session, "approved")
            assertTrue(requests.last().second.endsWith("?scope=approved"))
            assertEquals("Pessoa", api.fetchPhotoReviews(session).single().fullName)
            assertEquals("https://example.invalid/approved", api.fetchCompanyProfilePhotos(session)["synthetic"])
            api.reviewProfilePhoto(session, "synthetic", false, "Rosto pouco visível")
            val review = Json.parseToJsonElement(requests.last().third).jsonObject
            assertEquals("reject", review["decision"]?.jsonPrimitive?.content)
            assertEquals("synthetic", review["user_id"]?.jsonPrimitive?.content)
            api.signUpWithPassword("pessoa@example.invalid", "BomDia2027", "Pessoa Exemplo", "Estaca Exemplo")
            val metadata = Json.parseToJsonElement(requests.last().third).jsonObject["data"]!!.jsonObject
            assertEquals("Estaca Exemplo", metadata["stake"]?.jsonPrimitive?.content)
            assertFalse(metadata.containsKey("unit"))
        } finally {
            server.close(); worker.join(1000)
        }
    }

    @Test fun whatsappInviteValidationAndNormalizationFollowCanonicalContract() {
        val canonical = "https://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrStUv"
        assertEquals(canonical, normalizeWhatsappInvite(canonical))
        assertEquals(canonical, normalizeWhatsappInvite("  https://chat.whatsapp.com/invite/AbCdEfGhIjKlMnOpQrStUv/?mode=gi_t#fragment  "))
        assertTrue(WhatsappInviteValidator.isValidCanonical(canonical))

        assertNull(normalizeWhatsappInvite(""))
        assertNull(normalizeWhatsappInvite("http://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrStUv"))
        assertNull(normalizeWhatsappInvite("https://wa.me/5516999999999"))
        assertNull(normalizeWhatsappInvite("https://evil.example.com/AbCdEfGhIjKlMnOpQrStUv"))
        assertNull(normalizeWhatsappInvite("https://chat.whatsapp.com/curto123"))
        assertNull(normalizeWhatsappInvite("https://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789Extra"))

        val validModel = CompanyWhatsappLink(companyId = "c1", companyName = "Girassol", inviteUrl = "$canonical?foo=1")
        assertEquals(canonical, validModel.validInviteUrl)
        val invalidModel = CompanyWhatsappLink(companyId = "c1", companyName = "Girassol", inviteUrl = "https://evil.example/phish")
        assertNull(invalidModel.validInviteUrl)
    }

    @Test fun companyWhatsappGetAndPutFollowPortalContract() = runTest {
        val server = ServerSocket(0)
        val requests = mutableListOf<Triple<String, String, String>>()
        val worker = thread(isDaemon = true) {
            while (!server.isClosed) {
                val client = try { server.accept() } catch (_: Exception) { break }
                client.use {
                    val input = it.getInputStream()
                    val header = StringBuilder()
                    while (!header.endsWith("\r\n\r\n")) {
                        val byte = input.read()
                        if (byte < 0) return@use
                        header.append(byte.toChar())
                    }
                    val first = header.lineSequence().first().split(' ')
                    val length = Regex("Content-Length: (\\d+)", RegexOption.IGNORE_CASE).find(header)?.groupValues?.get(1)?.toInt() ?: 0
                    val body = input.readNBytes(length).toString(Charsets.UTF_8)
                    synchronized(requests) { requests.add(Triple(first[0], first[1], body)) }
                    val response = if (first[0] == "GET") {
                        """{"data":{"company":{"company_id":"c1","company_name":"Girassol","invite_url":"https://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrStUv","can_edit":true,"updated_at":"2027-02-06T09:00:00Z","updated_by_name":"Ana","has_counselor":true},"companies":[{"company_id":"c1","company_name":"Girassol","invite_url":"https://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrStUv","can_edit":true,"has_counselor":true},{"company_id":"c2","company_name":"Ipê","invite_url":null,"can_edit":true,"has_counselor":false}]}}"""
                    } else {
                        """{"data":{"company":{"company_id":"c1","company_name":"Girassol","invite_url":null,"can_edit":true,"updated_at":"2027-02-06T10:00:00Z","updated_by_name":"Ana","has_counselor":true}}}"""
                    }.toByteArray()
                    it.getOutputStream().apply {
                        write("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${response.size}\r\nConnection: close\r\n\r\n".toByteArray())
                        write(response); flush()
                    }
                }
            }
        }
        try {
            val base = "http://127.0.0.1:${server.localPort}"
            val api = PortalApiClient(base, "public-test", base)
            val session = UserSession("test-token", "test-refresh", userId = "synthetic")
            val fetched = api.fetchCompanyWhatsapp(session)
            assertEquals(2, fetched.size)
            assertEquals("c1", fetched[0].companyId)
            assertEquals("https://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrStUv", fetched[0].validInviteUrl)
            assertFalse(fetched[1].hasCounselor)

            val saved = api.saveCompanyWhatsapp(session, "c1", null)
            assertEquals("PUT", requests.last().first)
            assertTrue(requests.last().second.endsWith("/api/companies/whatsapp"))
            val bodyJson = Json.parseToJsonElement(requests.last().third).jsonObject
            assertEquals("c1", bodyJson["company_id"]?.jsonPrimitive?.content)
            assertTrue(bodyJson["invite_url"] is JsonNull)
            assertNull(saved.inviteUrl)
        } finally {
            server.close(); worker.join(1000)
        }
    }

    @Test fun friendlyErrorsTranslate401And403IntoPortuguese() {
        assertEquals("Sua sessão terminou. Entre novamente.", FriendlyErrors.message("Unauthorized", 401))
        assertEquals("Você não tem permissão para concluir esta ação.", FriendlyErrors.message("Forbidden", 403))
        assertEquals(
            "Sua sessão terminou. Entre novamente.",
            FriendlyErrors.of(ApiException(401, "Invalid JWT")),
        )
        assertEquals(
            "Você não tem permissão para concluir esta ação.",
            FriendlyErrors.of(ApiException(403, "Forbidden")),
        )
    }
}
