package app.quedamos.widget

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF

enum class AroState { ON, OFF }

/**
 * Pinta el aro en un Bitmap cuadrado. states va ordenado por slot:
 * (colorIndex, estado) por miembro. OFF no pinta arco: se ve la traza
 * (círculo completo en traceColor), igual que Aro.tsx.
 */
object AroRenderer {
    fun render(
        sizePx: Int,
        states: List<Pair<Int, AroState>>,
        traceColor: Int,
        memberColors: IntArray,
    ): Bitmap {
        val bitmap = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        val n = states.size.coerceAtLeast(1)

        // Radio en "unidades aro" 40x40 (viewBox de Aro.tsx: r=16 en 40) escalado al bitmap.
        val scale = sizePx / 40f
        val radiusUnits = 16f
        val strokeUnits = AroGeometry.strokeWidth(n, radiusUnits)
        val radiusPx = radiusUnits * scale
        val strokePx = strokeUnits * scale
        val center = sizePx / 2f
        val rect = RectF(center - radiusPx, center - radiusPx, center + radiusPx, center + radiusPx)

        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeCap = Paint.Cap.ROUND
            strokeWidth = strokePx
        }

        // Traza: círculo completo debajo de los arcos (Aro.tsx:32).
        paint.color = traceColor
        canvas.drawCircle(center, center, radiusPx, paint)

        states.forEachIndexed { index, (colorIndex, state) ->
            if (state == AroState.OFF) return@forEachIndexed
            val arc = AroGeometry.arc(n, index, radiusUnits)
            paint.color = memberColors[colorIndex % memberColors.size]
            canvas.drawArc(rect, arc.startDeg, arc.sweepDeg, false, paint)
        }
        return bitmap
    }
}
