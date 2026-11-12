package br.com.fsyrp2.app

import br.com.fsyrp2.app.update.AndroidReleaseMetadataDto
import br.com.fsyrp2.app.update.ApkArchiveInfo
import br.com.fsyrp2.app.update.ApkVerificationFailure
import br.com.fsyrp2.app.update.ApkVerificationResult
import br.com.fsyrp2.app.update.AppReleaseManifestDto
import br.com.fsyrp2.app.update.AppUpdateValidator
import br.com.fsyrp2.app.update.PlatformReleaseStatusDto
import org.junit.Assert.*
import org.junit.Test
import java.io.File

class AppUpdateValidatorTest {

    private val sha = "a".repeat(64)
    private val github = "https://github.com/alxgoes/fsy-event-app/releases/download/android-v1.3.1/fsy.apk"

    private fun manifest(
        versionCode: Int = 7,
        url: String? = github,
        hash: String? = sha,
        size: Long? = 1000L,
        appId: String = "br.com.fsyrp2.app",
        minSupported: Int? = null,
    ) = AppReleaseManifestDto(
        android = PlatformReleaseStatusDto(
            downloadUrl = url,
            androidMetadata = AndroidReleaseMetadataDto(
                applicationId = appId,
                versionName = "1.3.1",
                versionCode = versionCode,
                apkFileName = "fsy.apk",
                sizeBytes = size,
                sha256 = hash,
                minSupportedVersionCode = minSupported,
                releaseNotesPtBr = listOf("  Novidade  ", "", "a", "b", "c", "d", "e"),
            ),
        ),
    )

    @Test fun onlyGithubHttpsHostsAreAllowed() {
        assertTrue(AppUpdateValidator.isAllowedDownloadUrl(github))
        assertTrue(AppUpdateValidator.isAllowedDownloadUrl("https://objects.githubusercontent.com/x/y.apk"))
        assertFalse(AppUpdateValidator.isAllowedDownloadUrl("http://github.com/x.apk"))
        assertFalse(AppUpdateValidator.isAllowedDownloadUrl("https://evil.example/x.apk"))
        assertFalse(AppUpdateValidator.isAllowedDownloadUrl("https://github.com.evil.example/x.apk"))
        assertFalse(AppUpdateValidator.isAllowedDownloadUrl("https://user:pw@github.com/x.apk"))
        assertFalse(AppUpdateValidator.isAllowedDownloadUrl(null))
    }

    @Test fun newerVersionIsOfferedWithTrimmedNotes() {
        val update = AppUpdateValidator.evaluateManifest(manifest(), installedVersionCode = 6)
        assertNotNull(update)
        assertEquals(7, update!!.versionCode)
        assertFalse(update.isMandatory)
        assertEquals(5, update.releaseNotesPtBr.size)
        assertEquals("Novidade", update.releaseNotesPtBr.first())
    }

    @Test fun sameOrOlderVersionIsIgnored() {
        assertNull(AppUpdateValidator.evaluateManifest(manifest(versionCode = 6), installedVersionCode = 6))
        assertNull(AppUpdateValidator.evaluateManifest(manifest(versionCode = 5), installedVersionCode = 6))
    }

    @Test fun incompleteOrForeignManifestIsIgnored() {
        assertNull(AppUpdateValidator.evaluateManifest(manifest(hash = null), installedVersionCode = 6))
        assertNull(AppUpdateValidator.evaluateManifest(manifest(hash = "abc"), installedVersionCode = 6))
        assertNull(AppUpdateValidator.evaluateManifest(manifest(size = 0L), installedVersionCode = 6))
        assertNull(AppUpdateValidator.evaluateManifest(manifest(url = "https://evil.example/x.apk"), installedVersionCode = 6))
        assertNull(AppUpdateValidator.evaluateManifest(manifest(appId = "com.outro.app"), installedVersionCode = 6))
    }

    @Test fun belowMinimumSupportedIsMandatory() {
        val update = AppUpdateValidator.evaluateManifest(manifest(minSupported = 7), installedVersionCode = 6)
        assertTrue(update!!.isMandatory)
    }

    @Test fun automaticCheckRunsAtMostEverySixHours() {
        val now = 100L * 60 * 60 * 1000
        assertTrue(AppUpdateValidator.shouldRunAutomaticCheck(0L, now))
        assertFalse(AppUpdateValidator.shouldRunAutomaticCheck(now - 60_000L, now))
        assertTrue(AppUpdateValidator.shouldRunAutomaticCheck(now - 6L * 60 * 60 * 1000, now))
    }

    private fun apkWith(bytes: ByteArray): File =
        File.createTempFile("fsy-update", ".apk").apply { writeBytes(bytes); deleteOnExit() }

    private fun verify(file: File, archive: ApkArchiveInfo?, hash: String = AppUpdateValidator.computeSha256Hex(file)) =
        AppUpdateValidator.verifyDownloadedApk(
            apkFile = file,
            expectedSizeBytes = file.length(),
            expectedSha256 = hash,
            installedVersionCode = 6,
            installedCertSha256s = setOf("CERT"),
            archiveReader = { archive },
        )

    private fun archive(pkg: String = "br.com.fsyrp2.app", code: Long = 7, certs: Set<String> = setOf("cert")) =
        ApkArchiveInfo(packageName = pkg, versionCode = code, signerCertSha256s = certs)

    @Test fun verifiedApkPassesAllChecks() {
        assertTrue(verify(apkWith(byteArrayOf(1, 2, 3)), archive()) is ApkVerificationResult.Verified)
    }

    @Test fun tamperedApkIsRejectedAndDeleted() {
        val cases = listOf(
            Triple(archive(), "b".repeat(64), ApkVerificationFailure.SHA256_MISMATCH),
            Triple(archive(pkg = "com.outro.app"), null, ApkVerificationFailure.PACKAGE_MISMATCH),
            Triple(archive(code = 6), null, ApkVerificationFailure.VERSION_NOT_NEWER),
            Triple(archive(certs = setOf("outra")), null, ApkVerificationFailure.SIGNATURE_MISMATCH),
        )
        for ((info, badHash, failure) in cases) {
            val file = apkWith(byteArrayOf(9, 9, 9))
            val result = if (badHash != null) verify(file, info, badHash) else verify(file, info)
            assertEquals(failure, (result as ApkVerificationResult.Rejected).failure)
            assertFalse("arquivo recusado precisa ser apagado", file.exists())
        }
    }
}
