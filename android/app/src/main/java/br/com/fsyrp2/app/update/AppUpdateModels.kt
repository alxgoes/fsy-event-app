package br.com.fsyrp2.app.update

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class AndroidReleaseMetadataDto(
    val applicationId: String = "br.com.fsyrp2.app",
    val versionName: String = "1.0.0",
    val versionCode: Int = 1,
    val minSdk: Int = 26,
    val targetSdk: Int = 35,
    val compileSdk: Int = 35,
    val apkFileName: String = "",
    val sizeBytes: Long? = null,
    val sha256: String? = null,
    val signingSchemes: List<String> = emptyList(),
    val signerCertificateSha256: String? = null,
    val builtAtIso: String? = null,
    val minSupportedVersionCode: Int? = null,
    val releaseNotesPtBr: List<String> = emptyList(),
)

@Serializable
data class PlatformReleaseStatusDto(
    val platform: String = "android",
    val availability: String = "pwa_fallback",
    val downloadUrl: String? = null,
    val installInstructionsPtBr: List<String> = emptyList(),
    val androidMetadata: AndroidReleaseMetadataDto? = null,
)

@Serializable
data class AppReleaseManifestDto(
    val eventName: String = "",
    val updatedAtIso: String = "",
    val android: PlatformReleaseStatusDto? = null,
)

data class AvailableAppUpdate(
    val applicationId: String = "br.com.fsyrp2.app",
    val versionName: String,
    val versionCode: Int,
    val apkFileName: String,
    val downloadUrl: String,
    val sizeBytes: Long,
    val sha256: String,
    val signerCertificateSha256: String? = null,
    val minSupportedVersionCode: Int? = null,
    val releaseNotesPtBr: List<String> = emptyList(),
    val isMandatory: Boolean = false,
)

data class PostUpdateNotice(
    val versionName: String,
    val releaseNotesPtBr: List<String> = emptyList(),
)

sealed interface AppUpdateUiState {
    data object Idle : AppUpdateUiState
    data object Checking : AppUpdateUiState
    data class UpToDate(val checkedAtLabel: String? = null) : AppUpdateUiState
    data class Available(val update: AvailableAppUpdate) : AppUpdateUiState
    data class AwaitingMeteredConfirmation(val update: AvailableAppUpdate) : AppUpdateUiState
    data class Downloading(
        val update: AvailableAppUpdate,
        val progressFraction: Float? = null,
        val downloadedBytes: Long = 0L,
    ) : AppUpdateUiState
    data class ReadyToInstall(
        val update: AvailableAppUpdate,
        val apkFilePath: String,
    ) : AppUpdateUiState
    data class NeedsInstallPermission(
        val update: AvailableAppUpdate,
        val apkFilePath: String,
    ) : AppUpdateUiState
    data class Installing(val update: AvailableAppUpdate) : AppUpdateUiState
    data class Error(
        val messagePtBr: String,
        val update: AvailableAppUpdate? = null,
    ) : AppUpdateUiState

    val activeUpdate: AvailableAppUpdate?
        get() = when (this) {
            is Available -> update
            is AwaitingMeteredConfirmation -> update
            is Downloading -> update
            is ReadyToInstall -> update
            is NeedsInstallPermission -> update
            is Installing -> update
            is Error -> update
            else -> null
        }

    val isMandatoryBlocking: Boolean
        get() = activeUpdate?.isMandatory == true
}
