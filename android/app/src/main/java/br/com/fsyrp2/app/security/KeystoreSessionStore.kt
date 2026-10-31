package br.com.fsyrp2.app.security

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import br.com.fsyrp2.app.data.CardOrderManager
import br.com.fsyrp2.app.model.NotificationChannelPreferencesDto
import br.com.fsyrp2.app.model.UserSession
import br.com.fsyrp2.app.model.WidgetSnapshotDto
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.security.KeyStore
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Armazena a sessão autenticada criptografada com AES-256-GCM via Android Keystore
 * e garante isolamento de cache de layout, lembretes, widgets e vínculo FCM entre diferentes contas no dispositivo.
 */
class KeystoreSessionStore(context: Context) {
    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    private fun getOrCreateSecretKey(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        val existing = keyStore.getEntry(KEY_ALIAS, null) as? KeyStore.SecretKeyEntry
        if (existing != null) return existing.secretKey

        val keyGenerator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            ANDROID_KEYSTORE
        )
        val spec = KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .build()
        keyGenerator.init(spec)
        return keyGenerator.generateKey()
    }

    fun activeUserId(): String? = prefs.getString(KEY_ACTIVE_USER_ID, null)

    fun loadLocalSessionGeneration(): Long = prefs.getLong(KEY_LOCAL_SESSION_GEN, 1L)

    fun saveSession(session: UserSession) {
        val previousUserId = prefs.getString(KEY_ACTIVE_USER_ID, null)
        val currentGen = loadLocalSessionGeneration()
        val nextGen = if (previousUserId != null && previousUserId != session.userId) {
            currentGen + 1L
        } else {
            currentGen
        }
        purgeForeignUserKeys(session.userId)
        val rawBytes = json.encodeToString(session).toByteArray(Charsets.UTF_8)
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateSecretKey())
        val iv = Base64.encodeToString(cipher.iv, Base64.NO_WRAP)
        val encrypted = Base64.encodeToString(cipher.doFinal(rawBytes), Base64.NO_WRAP)
        prefs.edit()
            .putString(KEY_SESSION_IV, iv)
            .putString(KEY_SESSION_CIPHERTEXT, encrypted)
            .putString(KEY_ACTIVE_USER_ID, session.userId)
            .putLong(KEY_LOCAL_SESSION_GEN, nextGen)
            .apply()
    }

    fun loadSession(): UserSession? {
        val ivStr = prefs.getString(KEY_SESSION_IV, null) ?: return null
        val cipherStr = prefs.getString(KEY_SESSION_CIPHERTEXT, null) ?: return null
        return try {
            val iv = Base64.decode(ivStr, Base64.NO_WRAP)
            val encrypted = Base64.decode(cipherStr, Base64.NO_WRAP)
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.DECRYPT_MODE, getOrCreateSecretKey(), GCMParameterSpec(128, iv))
            val plain = String(cipher.doFinal(encrypted), Charsets.UTF_8)
            json.decodeFromString<UserSession>(plain)
        } catch (_: Exception) {
            clearSession()
            null
        }
    }

    fun clearSession() {
        val nextGen = loadLocalSessionGeneration() + 1L
        val editor = prefs.edit()
            .remove(KEY_SESSION_IV)
            .remove(KEY_SESSION_CIPHERTEXT)
            .remove(KEY_ACTIVE_USER_ID)
            .remove(KEY_PKCE_VERIFIER)
            .remove(KEY_PKCE_STATE)
            .remove(KEY_WIDGET_SNAPSHOT)
            .remove(KEY_PUSH_BOUND_USER_ID)
            .remove(KEY_PUSH_BOUND_DEVICE_ID)
            .remove(KEY_PUSH_BOUND_GENERATION)
            .putLong(KEY_LOCAL_SESSION_GEN, nextGen)

        for (k in prefs.all.keys) {
            if (k.startsWith("fsy:layout:v1:") ||
                k.startsWith("fsy:reminders:v1:") ||
                k.startsWith("fsy:notif_prefs:v1:")
            ) {
                editor.remove(k)
            }
        }
        editor.apply()
    }

    fun savePkceState(verifier: String, state: String) {
        prefs.edit()
            .putString(KEY_PKCE_VERIFIER, verifier)
            .putString(KEY_PKCE_STATE, state)
            .apply()
    }

    fun consumePkceVerifier(returnedState: String?): String? {
        val expectedState = prefs.getString(KEY_PKCE_STATE, null)
        val verifier = prefs.getString(KEY_PKCE_VERIFIER, null)
        prefs.edit().remove(KEY_PKCE_STATE).remove(KEY_PKCE_VERIFIER).apply()
        if (verifier.isNullOrBlank()) return null
        if (!returnedState.isNullOrBlank()) {
            if (expectedState.isNullOrBlank() || !PkceAuthHelper.verifyState(expectedState, returnedState)) {
                return null
            }
        }
        return verifier
    }

    fun loadCardOrder(userId: String, pageKey: String): List<String> {
        val defaults = CardOrderManager.PAGE_DEFAULT_IDS[pageKey] ?: emptyList()
        val key = CardOrderManager.cacheKey(userId, pageKey)
        val raw = prefs.getString(key, null) ?: return defaults
        val saved = raw.split(",").map { it.trim() }.filter { it.isNotEmpty() }
        return CardOrderManager.resolveOrder(defaults, saved)
    }

    fun saveCardOrder(userId: String, pageKey: String, orderedIds: List<String>) {
        purgeForeignUserKeys(userId)
        val key = CardOrderManager.cacheKey(userId, pageKey)
        prefs.edit().putString(key, orderedIds.joinToString(",")).apply()
    }

    fun getOrCreateDeviceId(userId: String): String {
        val key = "fsy:push:device_id:$userId"
        val existing = prefs.getString(key, null)
        if (!existing.isNullOrBlank() && existing.length >= 12) return existing
        return rotateDeviceId(userId)
    }

    fun rotateDeviceId(userId: String): String {
        val key = "fsy:push:device_id:$userId"
        val safeUserPrefix = userId.take(8).filter { it.isLetterOrDigit() }
        val newId = "andr_${safeUserPrefix}_${UUID.randomUUID().toString().replace("-", "")}"
        prefs.edit().putString(key, newId).apply()
        return newId
    }

    fun savePushBinding(userId: String, deviceId: String, bindingGeneration: Int) {
        prefs.edit()
            .putString(KEY_PUSH_BOUND_USER_ID, userId)
            .putString(KEY_PUSH_BOUND_DEVICE_ID, deviceId)
            .putInt(KEY_PUSH_BOUND_GENERATION, bindingGeneration)
            .apply()
    }

    fun loadBoundDeviceId(userId: String): String? {
        val boundUser = prefs.getString(KEY_PUSH_BOUND_USER_ID, null)
        if (boundUser != userId) return prefs.getString("fsy:push:device_id:$userId", null)
        return prefs.getString(KEY_PUSH_BOUND_DEVICE_ID, null)
            ?: prefs.getString("fsy:push:device_id:$userId", null)
    }

    /**
     * Valida estritamente se um payload FCM data-only pertence à sessão e ao vínculo ativos.
     * Descarta mensagens atrasadas (late-arrival) após logout ou troca de conta.
     */
    fun isValidIncomingFcmBinding(
        targetUserId: String?,
        deviceId: String?,
        bindingGenerationStr: String?
    ): Boolean {
        val session = loadSession() ?: return false
        val activeUser = session.userId
        if (targetUserId.isNullOrBlank() || targetUserId != activeUser) return false

        val expectedDeviceId = loadBoundDeviceId(activeUser) ?: return false
        if (deviceId.isNullOrBlank() || deviceId != expectedDeviceId) return false

        val storedGen = prefs.getInt(KEY_PUSH_BOUND_GENERATION, -1)
        val incomingGen = bindingGenerationStr?.toIntOrNull() ?: return false
        if (storedGen > 0 && incomingGen != storedGen) return false

        return true
    }

    fun loadNotificationPreferences(userId: String): NotificationChannelPreferencesDto {
        val raw = prefs.getString("fsy:notif_prefs:v1:$userId", null)
            ?: return NotificationChannelPreferencesDto()
        return try {
            json.decodeFromString<NotificationChannelPreferencesDto>(raw)
        } catch (_: Exception) {
            NotificationChannelPreferencesDto()
        }
    }

    fun saveNotificationPreferences(userId: String, preferences: NotificationChannelPreferencesDto) {
        val raw = json.encodeToString(preferences)
        prefs.edit().putString("fsy:notif_prefs:v1:$userId", raw).apply()
    }

    fun loadPersonalReminderIds(userId: String): Set<String> {
        val raw = prefs.getString("fsy:reminders:v1:$userId", null) ?: return emptySet()
        return raw.split(",").map { it.trim() }.filter { it.isNotEmpty() }.toSet()
    }

    fun savePersonalReminderIds(userId: String, activityIds: Set<String>) {
        prefs.edit()
            .putString("fsy:reminders:v1:$userId", activityIds.joinToString(","))
            .apply()
    }

    fun saveWidgetSnapshot(snapshot: WidgetSnapshotDto) {
        val activeUser = activeUserId()
        if (activeUser == null || activeUser != snapshot.userId) return
        val encoded = json.encodeToString(snapshot)
        prefs.edit().putString(KEY_WIDGET_SNAPSHOT, encoded).apply()
    }

    fun loadWidgetSnapshot(): WidgetSnapshotDto? {
        val activeUser = activeUserId() ?: return null
        val raw = prefs.getString(KEY_WIDGET_SNAPSHOT, null) ?: return null
        return try {
            val snap = json.decodeFromString<WidgetSnapshotDto>(raw)
            if (snap.userId == activeUser) snap else null
        } catch (_: Exception) {
            null
        }
    }

    private fun purgeForeignUserKeys(activeUserId: String) {
        val toRemove = prefs.all.keys.filter { key ->
            CardOrderManager.isForeignLayoutKey(key, activeUserId) ||
                (key.startsWith("fsy:reminders:v1:") && !key.endsWith(":$activeUserId")) ||
                (key.startsWith("fsy:notif_prefs:v1:") && !key.endsWith(":$activeUserId")) ||
                (key.startsWith("fsy:push:device_id:") && !key.endsWith(":$activeUserId"))
        }
        if (toRemove.isNotEmpty()) {
            val editor = prefs.edit()
            toRemove.forEach { editor.remove(it) }
            editor.apply()
        }
    }

    companion object {
        private const val ANDROID_KEYSTORE = "AndroidKeyStore"
        private const val KEY_ALIAS = "fsy_rp2_session_aes_key_v1"
        private const val TRANSFORMATION = "AES/GCM/NoPadding"
        private const val PREFS_NAME = "fsy_rp2_secure_store"
        private const val KEY_SESSION_IV = "session_iv"
        private const val KEY_SESSION_CIPHERTEXT = "session_ciphertext"
        private const val KEY_ACTIVE_USER_ID = "active_user_id"
        private const val KEY_LOCAL_SESSION_GEN = "local_session_generation"
        private const val KEY_PKCE_VERIFIER = "pkce_verifier"
        private const val KEY_PKCE_STATE = "pkce_state"
        private const val KEY_WIDGET_SNAPSHOT = "widget_public_snapshot_v1"
        private const val KEY_PUSH_BOUND_USER_ID = "push_bound_user_id"
        private const val KEY_PUSH_BOUND_DEVICE_ID = "push_bound_device_id"
        private const val KEY_PUSH_BOUND_GENERATION = "push_bound_generation"
    }
}
