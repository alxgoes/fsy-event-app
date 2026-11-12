package br.com.fsyrp2.app.update

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.os.Build

class AppUpdateInstallReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ACTION_INSTALL_STATUS) return
        val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)
        val prefs = AppUpdatePreferences(context)

        when (status) {
            PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                val confirmIntent: Intent? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java)
                } else {
                    @Suppress("DEPRECATION")
                    intent.getParcelableExtra(Intent.EXTRA_INTENT)
                }
                if (confirmIntent != null) {
                    confirmIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    runCatching { context.startActivity(confirmIntent) }.onFailure {
                        val msg = "Não foi possível abrir a confirmação de instalação. Tente de novo."
                        prefs.recordInstallError(msg)
                        listener?.invoke(status, msg)
                    }
                }
            }
            PackageInstaller.STATUS_SUCCESS -> {
                prefs.recordInstallError(null)
                listener?.invoke(status, null)
            }
            PackageInstaller.STATUS_FAILURE_ABORTED -> {
                val msg = "A instalação foi cancelada."
                prefs.recordInstallError(msg)
                listener?.invoke(status, msg)
            }
            PackageInstaller.STATUS_FAILURE_STORAGE -> {
                val msg = "Espaço insuficiente no aparelho para concluir a instalação."
                prefs.recordInstallError(msg)
                listener?.invoke(status, msg)
            }
            else -> {
                val msg = "Não foi possível concluir a instalação da atualização."
                prefs.recordInstallError(msg)
                listener?.invoke(status, msg)
            }
        }
    }

    companion object {
        const val ACTION_INSTALL_STATUS = "br.com.fsyrp2.app.ACTION_UPDATE_INSTALL_STATUS"
        const val EXTRA_UPDATE_VERSION_NAME = "extra_update_version_name"
        const val EXTRA_UPDATE_VERSION_CODE = "extra_update_version_code"

        @Volatile
        var listener: ((status: Int, errorMessagePtBr: String?) -> Unit)? = null
    }
}
