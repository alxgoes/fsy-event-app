package br.com.fsyrp2.app

import br.com.fsyrp2.app.model.UserSession
import br.com.fsyrp2.app.network.PortalApiClient
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test
import java.net.ServerSocket
import kotlin.concurrent.thread

class ProfilePhotoContractTest {
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
}
