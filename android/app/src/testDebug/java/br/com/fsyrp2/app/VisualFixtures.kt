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
