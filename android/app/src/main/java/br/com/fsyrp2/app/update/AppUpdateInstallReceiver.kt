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
                    val current = listener
                    if (current != null) {
                        // O app está aberto: a tela em primeiro plano mostra a confirmação (a Samsung
                        // bloqueia telas abertas por receptores em segundo plano e a sessão é cancelada).
                        current.invoke(status, null, confirmIntent)
                    } else {
                        confirmIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        runCatching { context.startActivity(confirmIntent) }.onFailure {
                            prefs.recordInstallError("Não foi possível abrir a confirmação de instalação. Toque em Instalar de novo.")
                        }
                    }
                }
            }
            PackageInstaller.STATUS_SUCCESS -> {
                prefs.recordInstallError(null)
                listener?.invoke(status, null, null)
            }
            PackageInstaller.STATUS_FAILURE_ABORTED -> {
                val msg = "A instalação não foi concluída. Toque em Instalar para abrir o instalador do Android."
                prefs.recordInstallError(msg)
                listener?.invoke(status, msg, null)
            }
            PackageInstaller.STATUS_FAILURE_STORAGE -> {
                val msg = "Espaço insuficiente no aparelho para concluir a instalação."
                prefs.recordInstallError(msg)
                listener?.invoke(status, msg, null)
            }
            else -> {
                val msg = "Não foi possível concluir a instalação. Toque em Instalar para abrir o instalador do Android."
                prefs.recordInstallError(msg)
                listener?.invoke(status, msg, null)
            }
        }
    }

    companion object {
        const val ACTION_INSTALL_STATUS = "br.com.fsyrp2.app.ACTION_UPDATE_INSTALL_STATUS"
        const val EXTRA_UPDATE_VERSION_NAME = "extra_update_version_name"
        const val EXTRA_UPDATE_VERSION_CODE = "extra_update_version_code"

        @Volatile
        var listener: ((status: Int, errorMessagePtBr: String?, confirmIntent: Intent?) -> Unit)? = null
    }
}
