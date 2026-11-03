package br.com.fsyrp2.app.data

import android.content.Context
import br.com.fsyrp2.app.model.OfflineSnapshot
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File

/**
 * Cópia local dos últimos dados vistos (perfil, companhia, agenda e avisos), para abrir o app
 * sem internet e mostrar com honestidade "dados de HH:MM". Arquivo privado do app, um por conta,
 * fora do backup (data_extraction_rules exclui `file`), apagado ao sair da conta.
 * Nada de saúde, inclusão ou lista de jovens é gravado aqui.
 */
class OfflineCache(context: Context) {
    private val dir = File(context.filesDir, "fsy_offline")
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    private fun fileFor(userId: String): File {
        val safe = userId.filter { it.isLetterOrDigit() || it == '-' }.take(64).ifBlank { "conta" }
        return File(dir, "$safe.json")
    }

    fun load(userId: String): OfflineSnapshot? = runCatching {
        val f = fileFor(userId)
        if (!f.exists()) return null
        json.decodeFromString<OfflineSnapshot>(f.readText(Charsets.UTF_8)).takeIf { it.userId == userId }
    }.getOrNull()

    fun save(snapshot: OfflineSnapshot) {
        runCatching {
            dir.mkdirs()
            // Só a conta ativa fica guardada.
            dir.listFiles()?.filter { it.name != fileFor(snapshot.userId).name }?.forEach { it.delete() }
            val target = fileFor(snapshot.userId)
            val tmp = File(dir, target.name + ".tmp")
            tmp.writeText(json.encodeToString(snapshot), Charsets.UTF_8)
            if (!tmp.renameTo(target)) {
                target.delete()
                tmp.renameTo(target)
            }
        }
    }

    fun clearAll() {
        runCatching { dir.listFiles()?.forEach { it.delete() } }
    }
}
