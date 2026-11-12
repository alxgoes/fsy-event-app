package br.com.fsyrp2.app

import java.net.ServerSocket
import kotlin.concurrent.thread

/** Servidor dentro do processo de teste: sem processo externo nem acesso ao portal real. */
internal class VisualFixtures(
    private val responses: Map<String, String> = emptyMap(),
    private val binaryResponses: Map<String, ByteArray> = emptyMap()
) : AutoCloseable {
    private val socket = ServerSocket(0)
    val port: Int get() = socket.localPort
    private val worker = thread(isDaemon = true, name = "fsy-visual-fixtures") {
        while (!socket.isClosed) {
            val client = try { socket.accept() } catch (_: Exception) { break }
            client.use {
                // Content-Length conta bytes: leitura de um byte por caractere evita
                // bloquear ao descartar corpos JSON com acentos nas fixtures.
                val reader = it.getInputStream().bufferedReader(Charsets.ISO_8859_1)
                val request = reader.readLine() ?: return@use
                val path = request.split(" ").getOrNull(1).orEmpty().substringBefore('?')
                var length = 0
                while (true) {
                    val line = reader.readLine() ?: break
                    if (line.isEmpty()) break
                    if (line.startsWith("Content-Length:", true)) length = line.substringAfter(':').trim().toInt()
                }
                repeat(length) { reader.read() }
                val text = responses[path] ?: when (path) {
                    "/api/admin/overview" -> """{"total_youth":120,"youth_with_company":108,"youth_with_room":108,"total_companies":5,"total_counselors":10}"""
                    "/api/profile/photo/reviews" -> """{"data":[{"user_id":"qa-2","full_name":"Jovem Exemplo","company_name":"Companhia Girassol","pending_url":"http://127.0.0.1:$port/qa/photo.png"}]}"""
                    "/api/admin/accounts" -> """{"data":[],"total":0,"page":1,"per_page":20}"""
                    "/api/admin/registrations" -> """{"items":[],"batches":[],"metrics":{},"pagination":{}}"""
                    "/api/announcements/like" -> """{"is_liked":true,"likes_count":13}"""
                    "/api/companies" -> """{"companies":[{"id":"qa-company","name":"Companhia Girassol","motto":"Juntos em Cristo","color":"#007DA5","room":"Sala 12"},{"id":"qa-company-2","name":"Companhia Ipê","motto":"Firmes na Fé","color":"#0F5D7A","room":"Sala 14"}],"all_counselors":[{"id":"qa-c1","full_name":"Ana Exemplo","company_id":"qa-company"}]}"""
                    "/rest/v1/companies" -> """[{"id":"qa-company","name":"Companhia Girassol","motto":"Juntos em Cristo","color":"#007DA5","room":"Sala 12"},{"id":"qa-company-2","name":"Companhia Ipê","motto":"Firmes na Fé","color":"#0F5D7A","room":"Sala 14"}]"""
                    "/rest/v1/profiles" -> """[{"id":"qa-c1","full_name":"Ana Exemplo","email":"ana@example.invalid","role":"consultor","company_id":"qa-company"}]"""
                    "/rest/v1/company_members" -> """[{"company_id":"qa-company","user_id":"qa-c1","role":"consultor"}]"""
                    "/api/companies/whatsapp" -> """{"data":{"company":{"company_id":"qa-company","company_name":"Companhia Girassol","invite_url":"https://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrStUv","can_edit":true,"updated_at":"2027-02-06T09:00:00Z","updated_by_name":"Ana Exemplo","has_counselor":true},"companies":[{"company_id":"qa-company","company_name":"Companhia Girassol","invite_url":"https://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrStUv","can_edit":true,"updated_at":"2027-02-06T09:00:00Z","updated_by_name":"Ana Exemplo","has_counselor":true},{"company_id":"qa-company-2","company_name":"Companhia Ipê","invite_url":null,"can_edit":true,"updated_at":null,"updated_by_name":null,"has_counselor":false}]}}"""
                    else -> """{"data":[]}"""
                }
                val photo = path.startsWith("/qa/photo")
                val binary = binaryResponses[path]
                val bytes = binary ?: if (photo) java.util.Base64.getDecoder().decode(
                    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF9sAAAAASUVORK5CYII="
                ) else text.toByteArray(Charsets.UTF_8)
                it.getOutputStream().apply {
                    write("HTTP/1.1 200 OK\r\nContent-Type: ${if (binary != null) "application/pdf" else if (photo) "image/png" else "application/json; charset=utf-8"}\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray())
                    write(bytes)
                    flush()
                }
            }
        }
    }
    override fun close() { socket.close(); worker.join(1000) }
}
