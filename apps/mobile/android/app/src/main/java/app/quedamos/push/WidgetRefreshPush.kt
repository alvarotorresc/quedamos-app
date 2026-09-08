package app.quedamos.push

/**
 * El push data-only que la API manda cuando otro miembro cambia algo del grupo
 * (apps/api/src/widget-refresh). No lleva bloque `notification` y no es un aviso para
 * nadie: sólo dice «vuelve a leer», y el único que debe enterarse es el widget.
 *
 * La tabla equivalente en JS está en apps/mobile/src/lib/push-routes.ts
 * (WIDGET_REFRESH_TYPE), donde además queda registrado que este tipo no abre pantalla.
 */
object WidgetRefreshPush {
    const val TYPE_KEY = "type"
    const val WIDGET_REFRESH = "widget_refresh"

    fun isWidgetRefresh(data: Map<String, String>): Boolean = data[TYPE_KEY] == WIDGET_REFRESH
}
