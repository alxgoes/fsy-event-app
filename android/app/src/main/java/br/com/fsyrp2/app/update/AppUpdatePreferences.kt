package br.com.fsyrp2.app.update

import android.content.Context
import br.com.fsyrp2.app.BuildConfig
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

class AppUpdatePreferences(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val json = Json { ignoreUnknownKeys = true }

    var autoUpdateEnabled: Boolean
        get() = prefs.getBoolean(KEY_AUTO_UPDATE_ENABLED, true)
        set(value) {
            prefs.edit().putBoolean(KEY_AUTO_UPDATE_ENABLED, value).apply()
        }

    var lastCheckEpochMs: Long
        get() = prefs.getLong(KEY_LAST_CHECK_EPOCH_MS, 0L)
        set(value) {
            prefs.edit().putLong(KEY_LAST_CHECK_EPOCH_MS, value).apply()
        }

    fun saveUpcomingReleaseNotes(versionCode: Int, versionName: String, notesPtBr: List<String>) {
        val cleanNotes = notesPtBr.map { it.trim() }.filter { it.isNotEmpty() }.take(5)
        prefs.edit()
            .putInt(KEY_PENDING_NOTES_VERSION_CODE, versionCode)
            .putString(KEY_PENDING_NOTES_VERSION_NAME, versionName)
            .putString(KEY_PENDING_NOTES_JSON, json.encodeToString(cleanNotes))
            .apply()
    }

    /**
     * Se a versão atual acabou de ser instalada (versionCode maior que o último visto),
     * retorna o aviso pós-atualização uma única vez.
     */
    fun peekPostUpdateNotice(
        currentVersionCode: Int = BuildConfig.VERSION_CODE,
        currentVersionName: String = BuildConfig.VERSION_NAME.removeSuffix("-debug"),
    ): PostUpdateNotice? {
        val lastSeenCode = prefs.getInt(KEY_LAST_SEEN_VERSION_CODE, 0)
        val dismissedCode = prefs.getInt(KEY_DISMISSED_POST_UPDATE_CODE, 0)
        if (lastSeenCode == 0) {
            prefs.edit().putInt(KEY_LAST_SEEN_VERSION_CODE, currentVersionCode).apply()
            return null
        }
        if (currentVersionCode <= lastSeenCode || dismissedCode >= currentVersionCode) {
            return null
        }
        val storedNotesCode = prefs.getInt(KEY_PENDING_NOTES_VERSION_CODE, 0)
        val rawJson = prefs.getString(KEY_PENDING_NOTES_JSON, null)
        val notes = if (storedNotesCode == currentVersionCode && !rawJson.isNullOrBlank()) {
            runCatching { json.decodeFromString<List<String>>(rawJson) }.getOrDefault(emptyList())
        } else {
            emptyList()
        }
        return PostUpdateNotice(
            versionName = currentVersionName,
            releaseNotesPtBr = notes,
        )
    }

    fun markPostUpdateNoticeDismissed(currentVersionCode: Int = BuildConfig.VERSION_CODE) {
        prefs.edit()
            .putInt(KEY_LAST_SEEN_VERSION_CODE, currentVersionCode)
            .putInt(KEY_DISMISSED_POST_UPDATE_CODE, currentVersionCode)
            .apply()
    }

    fun recordInstallError(messagePtBr: String?) {
        prefs.edit().putString(KEY_PENDING_INSTALL_ERROR, messagePtBr).apply()
    }

    fun consumePendingInstallError(): String? {
        val msg = prefs.getString(KEY_PENDING_INSTALL_ERROR, null)
        if (msg != null) {
            prefs.edit().remove(KEY_PENDING_INSTALL_ERROR).apply()
        }
        return msg
    }

    companion object {
        private const val PREFS_NAME = "fsy_app_update_prefs"
        private const val KEY_AUTO_UPDATE_ENABLED = "auto_update_enabled"
        private const val KEY_LAST_CHECK_EPOCH_MS = "last_check_epoch_ms"
        private const val KEY_LAST_SEEN_VERSION_CODE = "last_seen_version_code"
        private const val KEY_DISMISSED_POST_UPDATE_CODE = "dismissed_post_update_code"
        private const val KEY_PENDING_NOTES_VERSION_CODE = "pending_notes_version_code"
        private const val KEY_PENDING_NOTES_VERSION_NAME = "pending_notes_version_name"
        private const val KEY_PENDING_NOTES_JSON = "pending_notes_json"
        private const val KEY_PENDING_INSTALL_ERROR = "pending_install_error"
    }
}
