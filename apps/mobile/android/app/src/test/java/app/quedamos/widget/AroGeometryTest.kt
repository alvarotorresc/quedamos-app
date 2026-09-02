package app.quedamos.widget

import org.junit.Assert.assertEquals
import org.junit.Test
import kotlin.math.PI

class AroGeometryTest {

    @Test
    fun `n6 r16 dash y rotate de referencia`() {
        // aro-geometry.test.ts:5-11 — dash ≈ 9.46, rotate ≈ -106.9
        val arc = AroGeometry.arc(6, 0, 16f)
        val c = (2 * PI * 16).toFloat()
        val dash = arc.sweepDeg / 360f * c
        assertEquals(9.46f, dash, 0.05f)
        assertEquals(-106.9f, arc.startDeg, 0.5f)
    }

    @Test
    fun `slot i rota i por 360 entre n mas`() {
        // aro-geometry.test.ts:12-16
        val a0 = AroGeometry.arc(6, 0, 16f)
        val a3 = AroGeometry.arc(6, 3, 16f)
        assertEquals(180f, a3.startDeg - a0.startDeg, 0.001f)
    }

    @Test
    fun `short queda centrado en su hueco`() {
        // aro-geometry.test.ts:22-31 — mismo centro, barrido menor
        val full = AroGeometry.arc(6, 2, 16f)
        val short = AroGeometry.arc(6, 2, 16f, short = true)
        val centerFull = full.startDeg + full.sweepDeg / 2f
        val centerShort = short.startDeg + short.sweepDeg / 2f
        assertEquals(centerFull, centerShort, 0.1f)
        require(short.sweepDeg < full.sweepDeg)
    }

    @Test
    fun `radio grande satura gapVisible en 13`() {
        // aro-geometry.test.ts:102-115 — n=6 r=66 sw=5: dash ≈ 51.11, rotate ≈ -112.19
        val arc = AroGeometry.arc(6, 0, 66f, strokeWidth = 5f)
        val c = (2 * PI * 66).toFloat()
        val dash = arc.sweepDeg / 360f * c
        assertEquals(51.11f, dash, 0.1f)
        assertEquals(-112.19f, arc.startDeg, 0.1f)
    }

    @Test
    fun `strokeWidth degrada con n y radio`() {
        // aro-geometry.test.ts:76-87
        assertEquals(3.5f, AroGeometry.strokeWidth(6, 16f), 0.0001f)
        assertEquals(2.8f, AroGeometry.strokeWidth(12, 16f), 0.0001f)
        assertEquals(2.2f, AroGeometry.strokeWidth(20, 16f), 0.0001f)
        assertEquals(9f, AroGeometry.strokeWidth(6, 66f), 0.0001f)
        assertEquals(7f, AroGeometry.strokeWidth(12, 66f), 0.0001f)
        assertEquals(5.5f, AroGeometry.strokeWidth(20, 66f), 0.0001f)
    }
}
