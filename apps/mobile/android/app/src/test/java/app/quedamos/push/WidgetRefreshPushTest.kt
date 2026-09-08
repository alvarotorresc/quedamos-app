package app.quedamos.push

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * La decisión vive aparte del servicio a propósito: el servicio necesita
 * FirebaseMessagingService y un RemoteMessage para existir, y esto se puede
 * probar en la JVM sin nada de eso.
 */
class WidgetRefreshPushTest {

    @Test
    fun `reconoce el push de refresco de los widgets`() {
        assertTrue(WidgetRefreshPush.isWidgetRefresh(mapOf("type" to "widget_refresh")))
    }

    @Test
    fun `deja pasar cualquier otro aviso`() {
        assertFalse(WidgetRefreshPush.isWidgetRefresh(mapOf("type" to "new_event")))
        assertFalse(WidgetRefreshPush.isWidgetRefresh(mapOf("type" to "new_poll")))
    }

    @Test
    fun `un push sin type no es un refresco`() {
        assertFalse(WidgetRefreshPush.isWidgetRefresh(emptyMap()))
        assertFalse(WidgetRefreshPush.isWidgetRefresh(mapOf("groupId" to "g1")))
    }

    @Test
    fun `el type se compara exacto, no por parecido`() {
        assertFalse(WidgetRefreshPush.isWidgetRefresh(mapOf("type" to "Widget_Refresh")))
        assertFalse(WidgetRefreshPush.isWidgetRefresh(mapOf("type" to "widget_refresh_all")))
    }
}
