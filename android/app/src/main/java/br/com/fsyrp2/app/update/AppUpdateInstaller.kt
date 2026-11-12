package br.com.fsyrp2.app.update

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.net.ConnectivityManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import br.com.fsyrp2.app.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL

class UpdateDownloadException(val messagePtBr: String, cause: Throwable? = null) : IOException(messagePtBr, cause)

object AppUpdateInstaller {

    fun updatesDir(context: Context): File =
        File(context.applicationContext.cacheDir, "updates").apply { mkdirs() }

    fun cleanupOldUpdateFiles(dir: File, keepFileName: String? = null) {
        if (!dir.exists()) return
        val keepPart = keepFileName?.let { "$it.part" }
        dir.listFiles().orEmpty().forEach { f ->
            if (f.name != keepFileName && f.name != keepPart) {
                runCatching { f.delete() }
            }
        }
    }

    fun isNetworkMetered(context: Context): Boolean {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
            ?: return false
        return cm.isActiveNetworkMetered
    }

    fun canRequestPackageInstalls(context: Context): Boolean {
        return runCatching { context.packageManager.canRequestPackageInstalls() }.getOrDefault(false)
    }

    fun createUnknownSourcesPermissionIntent(context: Context): Intent {
        return Intent(
            Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
            Uri.parse("package:${context.packageName}"),
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }

    fun openUnknownSourcesSettings(context: Context): Boolean {
        return runCatching {
            context.startActivity(createUnknownSourcesPermissionIntent(context))
            true
        }.getOrDefault(false)
    }

    suspend fun downloadAndVerifyApk(
        context: Context,
        update: AvailableAppUpdate,
        onProgress: (downloadedBytes: Long, fraction: Float?) -> Unit,
    ): File = withContext(Dispatchers.IO) {
        val dir = updatesDir(context)
        cleanupOldUpdateFiles(dir, keepFileName = update.apkFileName)

        val targetFile = File(dir, update.apkFileName)
        val installedCerts = resolveInstalledCertificates(context, update)

        if (targetFile.exists() && targetFile.length() == update.sizeBytes) {
            val existingCheck = AppUpdateValidator.verifyDownloadedApk(
                apkFile = targetFile,
                expectedSizeBytes = update.sizeBytes,
                expectedSha256 = update.sha256,
                installedVersionCode = BuildConfig.VERSION_CODE.toLong(),
                installedCertSha256s = installedCerts,
                expectedPackageName = AppUpdateValidator.OFFICIAL_APPLICATION_ID,
                archiveReader = { file ->
                    AppUpdateValidator.readApkArchiveInfoFromPackageManager(context.packageManager, file)
                },
            )
            if (existingCheck is ApkVerificationResult.Verified) {
                onProgress(update.sizeBytes, 1f)
                return@withContext targetFile
            }
        }

        val usableSpace = runCatching { dir.usableSpace }.getOrDefault(Long.MAX_VALUE)
        if (usableSpace in 1 until (update.sizeBytes * 2L)) {
            throw UpdateDownloadException("Espaço insuficiente no aparelho para baixar a atualização.")
        }

        val partFile = File(dir, "${update.apkFileName}.part")
        if (partFile.exists() && partFile.length() >= update.sizeBytes) {
            runCatching { partFile.delete() }
        }
        val existingBytes = if (partFile.exists()) partFile.length().coerceAtLeast(0L) else 0L

        val conn = openAllowedRedirectConnection(update.downloadUrl, existingBytes)
        try {
            val status = conn.responseCode
            val resumeDownload = status == HttpURLConnection.HTTP_PARTIAL && existingBytes > 0L
            if (status != HttpURLConnection.HTTP_OK && status != HttpURLConnection.HTTP_PARTIAL) {
                throw UpdateDownloadException("Não foi possível baixar a atualização agora. Tente de novo.")
            }

            val startBytes = if (resumeDownload) existingBytes else 0L
            var downloaded = startBytes
            onProgress(downloaded, (downloaded.toFloat() / update.sizeBytes.toFloat()).coerceIn(0f, 1f))

            conn.inputStream.use { input ->
                FileOutputStream(partFile, resumeDownload).use { output ->
                    val buffer = ByteArray(16 * 1024)
                    while (true) {
                        currentCoroutineContext().ensureActive()
                        val read = input.read(buffer)
                        if (read < 0) break
                        if (read == 0) continue
                        downloaded += read
                        if (downloaded > update.sizeBytes) {
                            output.close()
                            runCatching { partFile.delete() }
                            throw UpdateDownloadException("O arquivo baixado não conferiu e foi descartado por segurança.")
                        }
                        output.write(buffer, 0, read)
                        val fraction = (downloaded.toFloat() / update.sizeBytes.toFloat()).coerceIn(0f, 1f)
                        onProgress(downloaded, fraction)
                    }
                    output.flush()
                    runCatching { output.fd.sync() }
                }
            }
        } catch (e: UpdateDownloadException) {
            throw e
        } catch (e: IOException) {
            throw UpdateDownloadException("Sem conexão para concluir o download. Verifique a internet e tente de novo.", e)
        } finally {
            conn.disconnect()
        }

        if (targetFile.exists()) {
            runCatching { targetFile.delete() }
        }
        if (!partFile.renameTo(targetFile)) {
            partFile.copyTo(targetFile, overwrite = true)
            runCatching { partFile.delete() }
        }

        val verification = AppUpdateValidator.verifyDownloadedApk(
            apkFile = targetFile,
            expectedSizeBytes = update.sizeBytes,
            expectedSha256 = update.sha256,
            installedVersionCode = BuildConfig.VERSION_CODE.toLong(),
            installedCertSha256s = installedCerts,
            expectedPackageName = AppUpdateValidator.OFFICIAL_APPLICATION_ID,
            archiveReader = { file ->
                AppUpdateValidator.readApkArchiveInfoFromPackageManager(context.packageManager, file)
            },
        )
        when (verification) {
            is ApkVerificationResult.Verified -> return@withContext targetFile
            is ApkVerificationResult.Rejected -> {
                throw UpdateDownloadException(verification.failure.messagePtBr)
            }
        }
    }

    private fun resolveInstalledCertificates(context: Context, update: AvailableAppUpdate): Set<String> {
        val fromPm = AppUpdateValidator.readInstalledSignerCerts(context.packageManager, context.packageName)
        if (fromPm.isNotEmpty()) return fromPm
        return update.signerCertificateSha256?.takeIf { it.isNotBlank() }?.let { setOf(it.lowercase()) } ?: emptySet()
    }

    private fun openAllowedRedirectConnection(initialUrl: String, resumeOffsetBytes: Long): HttpURLConnection {
        if (!AppUpdateValidator.isAllowedDownloadUrl(initialUrl)) {
            throw UpdateDownloadException("Endereço de download não permitido por segurança.")
        }
        var currentUrl = initialUrl
        val visitedUrls = mutableListOf(currentUrl)
        for (hop in 0..AppUpdateValidator.MAX_REDIRECT_HOPS) {
            val conn = (URL(currentUrl).openConnection() as HttpURLConnection).apply {
                instanceFollowRedirects = false
                requestMethod = "GET"
                connectTimeout = 15_000
                readTimeout = 30_000
                setRequestProperty("Accept", "application/vnd.android.package-archive, application/octet-stream")
                if (resumeOffsetBytes > 0L) {
                    setRequestProperty("Range", "bytes=$resumeOffsetBytes-")
                }
            }
            val code = conn.responseCode
            if (code in listOf(
                    HttpURLConnection.HTTP_MOVED_PERM,
                    HttpURLConnection.HTTP_MOVED_TEMP,
                    HttpURLConnection.HTTP_SEE_OTHER,
                    307,
                    308,
                )
            ) {
                val location = conn.getHeaderField("Location")?.trim()
                conn.disconnect()
                if (location.isNullOrEmpty()) {
                    throw UpdateDownloadException("Redirecionamento inválido durante o download.")
                }
                val resolved = runCatching { URI(currentUrl).resolve(location).toString() }.getOrNull()
                    ?: throw UpdateDownloadException("Redirecionamento inválido durante o download.")
                visitedUrls.add(resolved)
                if (!AppUpdateValidator.validateRedirectChain(visitedUrls)) {
                    throw UpdateDownloadException("Redirecionamento bloqueado por segurança (servidor externo não autorizado).")
                }
                currentUrl = resolved
                continue
            }
            return conn
        }
        throw UpdateDownloadException("Muitos redirecionamentos ao baixar a atualização.")
    }

    fun startPackageInstallerSession(
        context: Context,
        apkFile: File,
        update: AvailableAppUpdate,
    ) {
        val appContext = context.applicationContext
        val installer = appContext.packageManager.packageInstaller
        val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply {
            setAppPackageName(AppUpdateValidator.OFFICIAL_APPLICATION_ID)
            setSize(apkFile.length())
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
            }
        }

        val sessionId = installer.createSession(params)
        installer.openSession(sessionId).use { session ->
            session.openWrite("fsy_update.apk", 0, apkFile.length()).use { out ->
                FileInputStream(apkFile).use { input ->
                    input.copyTo(out, bufferSize = 16 * 1024)
                }
                session.fsync(out)
            }

            val callbackIntent = Intent(appContext, AppUpdateInstallReceiver::class.java).apply {
                action = AppUpdateInstallReceiver.ACTION_INSTALL_STATUS
                setPackage(appContext.packageName)
                putExtra(AppUpdateInstallReceiver.EXTRA_UPDATE_VERSION_NAME, update.versionName)
                putExtra(AppUpdateInstallReceiver.EXTRA_UPDATE_VERSION_CODE, update.versionCode)
            }
            val pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT or
                (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0)
            val pendingIntent = PendingIntent.getBroadcast(
                appContext,
                sessionId,
                callbackIntent,
                pendingFlags,
            )
            session.commit(pendingIntent.intentSender)
        }
    }
}
