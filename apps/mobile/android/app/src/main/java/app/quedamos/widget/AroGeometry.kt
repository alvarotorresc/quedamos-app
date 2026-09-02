package app.quedamos.widget

import kotlin.math.PI
import kotlin.math.max
import kotlin.math.min

/**
 * Port fiel de apps/mobile/src/lib/aro-geometry.ts (spec §5.3).
 * Convenio obligatorio: cada arco se centra en su hueco — startDeg =
 * ángulo de slot − medio arco. Canvas.drawArc comparte convenio angular
 * (0° a las 3, giro horario), así que los grados se usan tal cual.
 */
object AroGeometry {
    private const val SMALL_RADIUS = 20f

    fun strokeWidth(n: Int, radius: Float): Float =
        if (radius <= SMALL_RADIUS) {
            if (n <= 8) 3.5f else if (n <= 14) 2.8f else 2.2f
        } else {
            if (n <= 8) 9f else if (n <= 14) 7f else 5.5f
        }

    data class Arc(val startDeg: Float, val sweepDeg: Float)

    fun arc(
        n: Int,
        index: Int,
        radius: Float,
        strokeWidth: Float? = null,
        short: Boolean = false,
    ): Arc {
        val c = (2.0 * PI * radius).toFloat()
        val slot = c / n
        val sw = strokeWidth ?: AroGeometry.strokeWidth(n, radius)
        val small = radius <= SMALL_RADIUS
        val gapVisible = min(slot * 0.3f, if (small) 3.8f else 13f)
        val full = max(slot - sw - gapVisible, 1f)
        val dash = if (short) max(min(5f, full * 0.5f), 1f) else full
        val slotAngleDeg = -90f + index * (360f / n)
        val halfArcDeg = (dash / c) * 180f
        return Arc(startDeg = slotAngleDeg - halfArcDeg, sweepDeg = (dash / c) * 360f)
    }
}
