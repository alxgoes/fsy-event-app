package br.com.fsyrp2.app.update

import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.content.pm.Signature
import android.os.Build
import br.com.fsyrp2.app.BuildConfig
import java.io.File
import java.io.FileInputStream
import java.net.URI
import java.security.MessageDigest

data class ApkArchiveInfo(
    val packageName: String,
    val versionCode: Long,
    val signerCertSha256s: Set<String>,
)

enum class ApkVerificationFailure(val messagePtBr: String) {
    MISSING_OR_SIZE_MISMATCH("O arquivo baixado está incompleto e foi descartado. Tente novamente."),
    SHA256_MISMATCH("O arquivo baixado não conferiu e foi descartado por segurança."),
    INVALID_APK_ARCHIVE("O pacote baixado é inválido e foi descartado."),
    PACKAGE_MISMATCH("O pacote baixado não pertence ao aplicativo oficial FSY."),
    VERSION_NOT_NEWER("A versão baixada não é mais nova que a instalada."),
    SIGNATURE_MISMATCH("A assinatura do pacote baixado não confere com a versão instalada."),
}

sealed interface ApkVerificationResult {
    data class Verified(
        val file: File,
        val sha256: String,
        val archiveInfo: ApkArchiveInfo,
    ) : ApkVerificationResult

    data class Rejected(val failure: ApkVerificationFailure) : ApkVerificationResult
}

object AppUpdateValidator {
    const val OFFICIAL_APPLICATION_ID = "br.com.fsyrp2.app"
    const val MIN_AUTO_CHECK_INTERVAL_MS = 6L * 60L * 60L * 1000L
    const val MAX_REDIRECT_HOPS = 5

    val ALLOWED_DOWNLOAD_HOSTS: Set<String> = setOf(
        "github.com",
        "objects.githubusercontent.com",
        "release-assets.githubusercontent.com",
    )

    private val SHA256_HEX_REGEX = Regex("^[a-fA-F0-9]{64}$")
    private val SAFE_APK_FILENAME_REGEX = Regex("^[A-Za-z0-9._-]+\\.apk$", RegexOption.IGNORE_CASE)

    fun isAllowedDownloadUrl(rawUrl: String?): Boolean {
        val trimmed = rawUrl?.trim().orEmpty()
        if (trimmed.isEmpty() || trimmed.any { it.isWhitespace() }) return false
        return try {
            val uri = URI(trimmed)
            val scheme = uri.scheme?.lowercase() ?: return false
            if (scheme != "https") return false
            if (!uri.userInfo.isNullOrEmpty()) return false
            val host = uri.host?.lowercase() ?: return false
            if (host !in ALLOWED_DOWNLOAD_HOSTS) return false
            val path = uri.rawPath.orEmpty()
            path.isNotBlank() && !path.contains("..")
        } catch (_: Exception) {
            false
        }
    }

    fun validateRedirectChain(urls: List<String>): Boolean {
        if (urls.isEmpty() || urls.size > MAX_REDIRECT_HOPS + 1) return false
        return urls.all { isAllowedDownloadUrl(it) }
    }

    fun shouldRunAutomaticCheck(lastCheckEpochMs: Long, nowEpochMs: Long): Boolean {
        if (lastCheckEpochMs <= 0L) return true
        return (nowEpochMs - lastCheckEpochMs) >= MIN_AUTO_CHECK_INTERVAL_MS
    }

    fun evaluateManifest(
        manifest: AppReleaseManifestDto,
        installedVersionCode: Int = BuildConfig.VERSION_CODE,
        expectedApplicationId: String = OFFICIAL_APPLICATION_ID,
    ): AvailableAppUpdate? {
        val android = manifest.android ?: return null
        val meta = android.androidMetadata ?: return null
        if (meta.applicationId.trim() != expectedApplicationId) return null

        val sha256 = meta.sha256?.trim()?.lowercase() ?: return null
        if (!SHA256_HEX_REGEX.matches(sha256)) return null

        val sizeBytes = meta.sizeBytes ?: return null
        if (sizeBytes <= 0L) return null

        val downloadUrl = android.downloadUrl?.trim() ?: return null
        if (!isAllowedDownloadUrl(downloadUrl)) return null

        val minSupported = meta.minSupportedVersionCode?.takeIf { it >= 1 }
        val isMandatory = minSupported != null && installedVersionCode < minSupported
        val isNewer = meta.versionCode > installedVersionCode
        if (!isNewer && !isMandatory) return null

        val rawFileName = meta.apkFileName.trim().ifBlank {
            "fsy-rp2-2027-v${meta.versionName.trim()}-release.apk"
        }
        val safeFileName = if (SAFE_APK_FILENAME_REGEX.matches(rawFileName)) {
            rawFileName
        } else {
            "fsy-rp2-2027-v${meta.versionCode}-release.apk"
        }

        val cleanNotes = meta.releaseNotesPtBr
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .take(5)

        return AvailableAppUpdate(
            applicationId = expectedApplicationId,
            versionName = meta.versionName.trim().ifBlank { meta.versionCode.toString() },
            versionCode = meta.versionCode,
            apkFileName = safeFileName,
            downloadUrl = downloadUrl,
            sizeBytes = sizeBytes,
            sha256 = sha256,
            signerCertificateSha256 = meta.signerCertificateSha256?.trim()?.lowercase(),
            minSupportedVersionCode = minSupported,
            releaseNotesPtBr = cleanNotes,
            isMandatory = isMandatory,
        )
    }

    fun computeSha256Hex(bytes: ByteArray): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(bytes)
        return digest.joinToString("") { "%02x".format(it) }
    }

    fun computeSha256Hex(file: File): String {
        val md = MessageDigest.getInstance("SHA-256")
        val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
        FileInputStream(file).use { input ->
            while (true) {
                val read = input.read(buffer)
                if (read <= 0) break
                md.update(buffer, 0, read)
            }
        }
        return md.digest().joinToString("") { "%02x".format(it) }
    }

    /**
     * Confere tamanho, SHA-256, applicationId, versionCode crescente e certificado de assinatura.
     * Em qualquer falha, apaga imediatamente o arquivo e recusa a instalação.
     */
    fun verifyDownloadedApk(
        apkFile: File,
        expectedSizeBytes: Long,
        expectedSha256: String,
        installedVersionCode: Long,
        installedCertSha256s: Set<String>,
        expectedPackageName: String = OFFICIAL_APPLICATION_ID,
        archiveReader: (File) -> ApkArchiveInfo?,
    ): ApkVerificationResult {
        fun reject(failure: ApkVerificationFailure): ApkVerificationResult {
            runCatching { if (apkFile.exists()) apkFile.delete() }
            return ApkVerificationResult.Rejected(failure)
        }

        if (!apkFile.exists() || !apkFile.isFile || expectedSizeBytes <= 0L || apkFile.length() != expectedSizeBytes) {
            return reject(ApkVerificationFailure.MISSING_OR_SIZE_MISMATCH)
        }

        val normalizedExpectedHash = expectedSha256.trim().lowercase()
        if (!SHA256_HEX_REGEX.matches(normalizedExpectedHash)) {
            return reject(ApkVerificationFailure.SHA256_MISMATCH)
        }

        val actualHash = runCatching { computeSha256Hex(apkFile) }.getOrNull()
            ?: return reject(ApkVerificationFailure.SHA256_MISMATCH)
        if (!actualHash.equals(normalizedExpectedHash, ignoreCase = true)) {
            return reject(ApkVerificationFailure.SHA256_MISMATCH)
        }

        val archiveInfo = runCatching { archiveReader(apkFile) }.getOrNull()
            ?: return reject(ApkVerificationFailure.INVALID_APK_ARCHIVE)

        if (archiveInfo.packageName != expectedPackageName) {
            return reject(ApkVerificationFailure.PACKAGE_MISMATCH)
        }

        if (archiveInfo.versionCode <= installedVersionCode) {
            return reject(ApkVerificationFailure.VERSION_NOT_NEWER)
        }

        val normalizedInstalledCerts = installedCertSha256s.map { it.trim().lowercase() }.filter { it.isNotEmpty() }.toSet()
        val normalizedArchiveCerts = archiveInfo.signerCertSha256s.map { it.trim().lowercase() }.filter { it.isNotEmpty() }.toSet()
        if (
            normalizedInstalledCerts.isEmpty() ||
            normalizedArchiveCerts.isEmpty() ||
            normalizedArchiveCerts != normalizedInstalledCerts
        ) {
            return reject(ApkVerificationFailure.SIGNATURE_MISMATCH)
        }

        return ApkVerificationResult.Verified(
            file = apkFile,
            sha256 = actualHash,
            archiveInfo = archiveInfo,
        )
    }

    @Suppress("DEPRECATION")
    fun readApkArchiveInfoFromPackageManager(
        packageManager: PackageManager,
        apkFile: File,
    ): ApkArchiveInfo? {
        val path = apkFile.absolutePath
        val archived: PackageInfo? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            packageManager.getPackageArchiveInfo(
                path,
                PackageManager.PackageInfoFlags.of(PackageManager.GET_SIGNING_CERTIFICATES.toLong())
            )
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            packageManager.getPackageArchiveInfo(path, PackageManager.GET_SIGNING_CERTIFICATES)
        } else {
            packageManager.getPackageArchiveInfo(path, PackageManager.GET_SIGNATURES)
        }
        val pkgInfo = archived ?: return null

        val versionCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            pkgInfo.longVersionCode
        } else {
            pkgInfo.versionCode.toLong()
        }
        val certs = extractSigningCertSha256s(pkgInfo)
        return ApkArchiveInfo(
            packageName = pkgInfo.packageName.orEmpty(),
            versionCode = versionCode,
            signerCertSha256s = certs,
        )
    }

    @Suppress("DEPRECATION")
    fun readInstalledSignerCerts(
        packageManager: PackageManager,
        packageName: String,
    ): Set<String> {
        return runCatching {
            val pkgInfo: PackageInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                packageManager.getPackageInfo(
                    packageName,
                    PackageManager.PackageInfoFlags.of(PackageManager.GET_SIGNING_CERTIFICATES.toLong())
                )
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                packageManager.getPackageInfo(packageName, PackageManager.GET_SIGNING_CERTIFICATES)
            } else {
                packageManager.getPackageInfo(packageName, PackageManager.GET_SIGNATURES)
            }
            extractSigningCertSha256s(pkgInfo)
        }.getOrDefault(emptySet())
    }

    @Suppress("DEPRECATION")
    internal fun extractSigningCertSha256s(pkgInfo: PackageInfo): Set<String> {
        val signatures: Array<Signature> = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val signingInfo = pkgInfo.signingInfo
            when {
                signingInfo == null -> pkgInfo.signatures ?: emptyArray()
                signingInfo.hasMultipleSigners() -> signingInfo.apkContentsSigners ?: emptyArray()
                else -> signingInfo.signingCertificateHistory ?: signingInfo.apkContentsSigners ?: emptyArray()
            }
        } else {
            pkgInfo.signatures ?: emptyArray()
        }
        return signatures.mapNotNull { sig ->
            runCatching { computeSha256Hex(sig.toByteArray()) }.getOrNull()
        }.toSet()
    }
}
