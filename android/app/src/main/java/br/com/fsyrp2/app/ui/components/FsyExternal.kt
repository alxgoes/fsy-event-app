package br.com.fsyrp2.app.ui.components

import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.animation.Crossfade
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import br.com.fsyrp2.app.ui.icons.FsyIcons
import br.com.fsyrp2.app.ui.motion.FsyMotion
import br.com.fsyrp2.app.ui.motion.fsyMotionPreferences
import androidx.compose.animation.core.tween
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * Memória curta de imagens públicas já baixadas (miniaturas do Instagram/Drive e fotos de
 * perfil aprovadas), só em RAM: nada é gravado em disco. Também permite que as capturas de
 * teste registrem imagens sintéticas para URLs fictícias.
 */
object RemoteImageMemory {
    private val cache = object : android.util.LruCache<String, ImageBitmap>(48) {}
    fun get(url: String): ImageBitmap? = cache.get(url)
    fun put(url: String, bitmap: ImageBitmap) {
        cache.put(url, bitmap)
    }
    fun clear() { cache.evictAll() }
}

/**
 * Carregador nativo para imagens públicas ou assinadas (HTTPS), reduzido para no máximo
 * [maxDimensionPx] e guardado só em memória. [onError] avisa quando a URL falhou (ex.: link
 * assinado expirado) para quem chamou buscar outro.
 */
@Composable
fun RemotePublicImage(
    url: String,
    contentDescription: String?,
    modifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.Crop,
    showPlaceholder: Boolean = true,
    maxDimensionPx: Int = 1280,
    onError: (() -> Unit)? = null,
) {
    var bitmap by remember(url) { mutableStateOf(RemoteImageMemory.get(url)) }
    var failed by remember(url) { mutableStateOf(false) }

    LaunchedEffect(url) {
        if (bitmap != null) return@LaunchedEffect
        if (url.isBlank() || !url.startsWith("https://")) {
            failed = true
            onError?.invoke()
            return@LaunchedEffect
        }
        val loaded = withContext(Dispatchers.IO) {
            try {
                val conn = (URL(url).openConnection() as HttpURLConnection).apply {
                    connectTimeout = 10000
                    readTimeout = 15000
                    instanceFollowRedirects = true
                }
                try {
                    if (conn.responseCode in 200..299) {
                        val bytes = conn.inputStream.use { it.readBytes() }
                        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
                        var sample = 1
                        while (maxOf(bounds.outWidth, bounds.outHeight) / (sample * 2) >= maxDimensionPx) sample *= 2
                        val opts = BitmapFactory.Options().apply { inSampleSize = sample }
                        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, opts)?.asImageBitmap()
                    } else null
                } finally {
                    conn.disconnect()
                }
            } catch (_: Exception) {
                null
            }
        }
        if (loaded != null) {
            RemoteImageMemory.put(url, loaded)
            bitmap = loaded
        } else {
            failed = true
            onError?.invoke()
        }
    }

    val reduceMotion = fsyMotionPreferences().reduceMotion
    Crossfade(
        targetState = bitmap,
        animationSpec = tween(if (reduceMotion) FsyMotion.REDUCED_FADE_MS else FsyMotion.BASE_MS),
        label = "RemoteImageReveal",
        modifier = modifier,
    ) { currentBitmap ->
        if (currentBitmap != null) {
            Image(
                bitmap = currentBitmap,
                contentDescription = contentDescription,
                modifier = Modifier.fillMaxSize(),
                contentScale = contentScale
            )
        } else if (showPlaceholder) {
            // Espaço reservado silencioso: sem texto técnico, ícone só quando falhou.
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(MaterialTheme.colorScheme.surfaceContainerHigh),
                contentAlignment = Alignment.Center
            ) {
                if (failed) {
                    Icon(
                        imageVector = FsyIcons.Image,
                        contentDescription = contentDescription,
                        tint = MaterialTheme.colorScheme.outline,
                        modifier = Modifier.size(24.dp)
                    )
                }
            }
        } else {
            Box(Modifier.fillMaxSize())
        }
    }
}

object ExternalUrlLauncher {
    private const val PRIVATE_DOCUMENT_TTL_MS = 15 * 60 * 1000L

    /** Descarta os documentos da conta ao sair ou trocar de pessoa. */
    fun clearPrivateDocuments(context: Context) {
        val dir = File(context.cacheDir, "documents")
        dir.listFiles()?.filter { it.isFile }?.forEach { file ->
            revokeAndDeletePrivateDocument(context, file)
        }
        if (dir.isDirectory && dir.listFiles()?.isEmpty() == true) runCatching { dir.delete() }
    }

    /** Abertura/retomada do app também expira arquivos, mesmo sem um novo download. */
    fun purgeExpiredPrivateDocuments(context: Context) {
        val cutoff = System.currentTimeMillis() - PRIVATE_DOCUMENT_TTL_MS
        File(context.cacheDir, "documents").listFiles()
            ?.filter { it.isFile && it.lastModified() < cutoff }
            ?.forEach { file -> revokeAndDeletePrivateDocument(context, file) }
    }

    private fun revokeAndDeletePrivateDocument(context: Context, file: File) {
        runCatching {
            val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
            context.revokeUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        runCatching { file.delete() }
    }

    fun openExternalUrl(context: Context, url: String) {
        val trimmed = url.trim()
        if (!trimmed.startsWith("https://")) return
        val uri = Uri.parse(trimmed)
        try {
            val customTabs = CustomTabsIntent.Builder()
                .setShowTitle(true)
                .build()
            customTabs.launchUrl(context, uri)
        } catch (_: Exception) {
            try {
                val fallback = Intent(Intent.ACTION_VIEW, uri).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(fallback)
            } catch (_: Exception) {
                // Nenhum navegador instalado
            }
        }
    }

    fun shareOrViewPrivateDocument(
        context: Context,
        filename: String,
        mimeType: String,
        bytes: ByteArray
    ) {
        val safeName = filename.replace(Regex("[^A-Za-z0-9._ -]"), "_").ifBlank { "documento_fsy" }
        val dir = File(context.cacheDir, "documents").apply { mkdirs() }
        purgeExpiredPrivateDocuments(context)
        val targetFile = File(dir, safeName)
        targetFile.writeBytes(bytes)
        val uri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            targetFile
        )
        val viewIntent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, mimeType)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        val shareIntent = Intent(Intent.ACTION_SEND).apply {
            type = mimeType
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        try {
            context.startActivity(viewIntent)
        } catch (_: Exception) {
            val chooser = Intent.createChooser(shareIntent, "Salvar ou compartilhar $safeName").apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            runCatching { context.startActivity(chooser) }
        }
    }
}

/** Abre o discador com o número já preenchido (não liga sozinho; não exige permissão). */
fun openDialer(context: Context, phone: String) {
    val digits = phone.filter { it.isDigit() || it == '+' }
    if (digits.length < 8) return
    runCatching {
        context.startActivity(
            Intent(Intent.ACTION_DIAL, Uri.parse("tel:$digits")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
    }
}
