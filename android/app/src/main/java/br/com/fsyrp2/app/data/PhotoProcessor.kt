package br.com.fsyrp2.app.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageDecoder
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import android.os.Build
import java.io.ByteArrayOutputStream
import kotlin.math.max
import kotlin.math.min

/**
 * Prepara a foto de perfil escolhida no seletor do sistema: recorte quadrado central,
 * no máximo [targetSize] px de lado e JPEG com qualidade [quality]. Tudo no aparelho;
 * a imagem original não é guardada.
 */
object PhotoProcessor {
    const val MAX_UPLOAD_BYTES = 5 * 1024 * 1024

    fun squareJpeg(context: Context, uri: Uri, targetSize: Int = 1024, quality: Int = 85): ByteArray? {
        val decoded = runCatching { decode(context, uri, targetSize) }.getOrNull() ?: return null
        return try {
            val side = min(decoded.width, decoded.height)
            val x = (decoded.width - side) / 2
            val y = (decoded.height - side) / 2
            val square = Bitmap.createBitmap(decoded, x, y, side, side)
            val finalSide = min(side, targetSize)
            val scaled = if (finalSide != side) Bitmap.createScaledBitmap(square, finalSide, finalSide, true) else square
            var q = quality
            var bytes: ByteArray
            do {
                val out = ByteArrayOutputStream()
                scaled.compress(Bitmap.CompressFormat.JPEG, q, out)
                bytes = out.toByteArray()
                q -= 10
            } while (bytes.size > MAX_UPLOAD_BYTES && q >= 45)
            if (scaled !== square) scaled.recycle()
            if (square !== decoded) square.recycle()
            bytes.takeIf { it.size <= MAX_UPLOAD_BYTES }
        } finally {
            decoded.recycle()
        }
    }

    private fun decode(context: Context, uri: Uri, targetSize: Int): Bitmap? {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val source = ImageDecoder.createSource(context.contentResolver, uri)
            // ImageDecoder já aplica a orientação gravada pela câmera.
            ImageDecoder.decodeBitmap(source) { decoder, info, _ ->
                decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
                val minSide = min(info.size.width, info.size.height)
                var sample = 1
                while (minSide / (sample * 2) >= targetSize) sample *= 2
                decoder.setTargetSampleSize(sample)
            }
        } else {
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            context.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
            val minSide = min(bounds.outWidth, bounds.outHeight)
            if (minSide <= 0) return null
            var sample = 1
            while (minSide / (sample * 2) >= targetSize) sample *= 2
            val opts = BitmapFactory.Options().apply { inSampleSize = max(1, sample) }
            val bitmap = context.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, opts) }
                ?: return null
            val orientation = runCatching {
                context.contentResolver.openInputStream(uri)?.use {
                    ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
                }
            }.getOrNull()
            val matrix = Matrix().apply {
                when (orientation) {
                    ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> setScale(-1f, 1f)
                    ExifInterface.ORIENTATION_ROTATE_180 -> setRotate(180f)
                    ExifInterface.ORIENTATION_FLIP_VERTICAL -> setScale(1f, -1f)
                    ExifInterface.ORIENTATION_TRANSPOSE -> { setRotate(90f); postScale(-1f, 1f) }
                    ExifInterface.ORIENTATION_ROTATE_90 -> setRotate(90f)
                    ExifInterface.ORIENTATION_TRANSVERSE -> { setRotate(-90f); postScale(-1f, 1f) }
                    ExifInterface.ORIENTATION_ROTATE_270 -> setRotate(-90f)
                }
            }
            if (matrix.isIdentity) bitmap else {
                Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true).also {
                    if (it !== bitmap) bitmap.recycle()
                }
            }
        }
    }
}
