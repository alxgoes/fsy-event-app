package br.com.fsyrp2.app.data

import kotlin.math.max
import kotlin.math.min

/**
 * Mesmo algoritmo de ordenação da web, com os cartões próprios das telas nativas.
 * As chaves locais seguem `fsy:layout:v1:{userId}:{pageKey}` e nunca vazam entre contas.
 */
object CardOrderManager {
    private const val PREFIX = "fsy:layout:v1:"

    val PAGE_DEFAULT_IDS: Map<String, List<String>> = mapOf(
        "dashboard" to listOf("next-activity", "announcements", "company", "gallery"),
        "admin-metrics" to listOf("youth-total", "companies-total", "counselors-total", "medical-total", "inclusion-open", "announcements-urgent"),
        "admin-modules" to listOf(
            "medical",
            "users",
            "companies",
            "schedule",
            "logistics",
            "announcements",
            "media",
            "inclusion",
            "counselor-audit",
            "registrations"
        ),
        "medical-metrics" to listOf("total-records", "allergies", "medications", "dietary"),
        "consultor-metrics" to listOf("youth-count", "company-room", "company-motto"),
        "consultor-announcements" to listOf("publish-form", "published-list")
    )

    fun cacheKey(userId: String, pageKey: String): String = "$PREFIX$userId:$pageKey"

    fun isForeignLayoutKey(key: String, userId: String): Boolean {
        return key.startsWith(PREFIX) && !key.startsWith("$PREFIX$userId:")
    }

    /**
     * Combina a ordem salva com a lista atual de cartões: descarta ids desconhecidos/duplicados
     * e insere cartões novos depois do último cartão que os antecede na ordem padrão.
     */
    fun resolveOrder(defaultIds: List<String>, saved: List<String>?): List<String> {
        if (saved.isNullOrEmpty()) return defaultIds.toList()
        val known = defaultIds.toSet()
        val result = mutableListOf<String>()
        for (id in saved) {
            if (known.contains(id) && !result.contains(id)) {
                result.add(id)
            }
        }
        if (result.isEmpty()) return defaultIds.toList()

        defaultIds.forEachIndexed { index, id ->
            if (result.contains(id)) return@forEachIndexed
            var position = 0
            for (i in 0 until index) {
                val predIdx = result.indexOf(defaultIds[i])
                if (predIdx >= 0) {
                    position = max(position, predIdx + 1)
                }
            }
            result.add(position, id)
        }
        return result
    }

    fun moveTo(order: List<String>, id: String, index: Int): List<String> {
        val from = order.indexOf(id)
        if (from == -1) return order.toList()
        val target = max(0, min(order.size - 1, index))
        if (target == from) return order.toList()
        val next = order.toMutableList()
        next.removeAt(from)
        next.add(target, id)
        return next
    }

    fun moveBy(order: List<String>, id: String, delta: Int): List<String> {
        val currentIdx = order.indexOf(id)
        if (currentIdx == -1) return order.toList()
        return moveTo(order, id, currentIdx + delta)
    }

    fun isDefaultOrder(defaultIds: List<String>, order: List<String>): Boolean {
        return defaultIds.size == order.size && defaultIds.indices.all { defaultIds[it] == order[it] }
    }
}
