package br.com.fsyrp2.app.update

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import br.com.fsyrp2.app.network.PortalApiClient
import java.util.concurrent.TimeUnit

class AppUpdateWorker(
    appContext: Context,
    params: WorkerParameters,
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val prefs = AppUpdatePreferences(applicationContext)
        val now = System.currentTimeMillis()
        if (!AppUpdateValidator.shouldRunAutomaticCheck(prefs.lastCheckEpochMs, now)) {
            return Result.success()
        }
        return try {
            val api = PortalApiClient()
            val manifest = api.fetchAppReleaseManifest()
            prefs.lastCheckEpochMs = now
            val available = AppUpdateValidator.evaluateManifest(manifest) ?: return Result.success()
            prefs.saveUpcomingReleaseNotes(
                versionCode = available.versionCode,
                versionName = available.versionName,
                notesPtBr = available.releaseNotesPtBr,
            )
            if (prefs.autoUpdateEnabled && !AppUpdateInstaller.isNetworkMetered(applicationContext)) {
                runCatching {
                    AppUpdateInstaller.downloadAndVerifyApk(
                        context = applicationContext,
                        update = available,
                        onProgress = { _, _ -> },
                    )
                }
            }
            Result.success()
        } catch (_: Exception) {
            Result.retry()
        }
    }

    companion object {
        private const val UNIQUE_WORK_NAME = "fsy_daily_app_update_check"

        fun schedulePeriodicCheck(context: Context) {
            runCatching {
                val constraints = Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
                val request = PeriodicWorkRequestBuilder<AppUpdateWorker>(24, TimeUnit.HOURS)
                    .setConstraints(constraints)
                    .build()
                WorkManager.getInstance(context.applicationContext).enqueueUniquePeriodicWork(
                    UNIQUE_WORK_NAME,
                    ExistingPeriodicWorkPolicy.KEEP,
                    request,
                )
            }
        }
    }
}
