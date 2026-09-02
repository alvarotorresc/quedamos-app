package app.quedamos.widget

/**
 * Deep links que abren la app desde los widgets. El host tiene que estar en el
 * intent-filter verificado del manifest (App Links) o Android abrirá el navegador.
 */
object WidgetDeepLink {
    const val PUBLIC_WEB_URL = "https://quedamos.alvarotc.com"

    fun calendar(groupId: String): String = "$PUBLIC_WEB_URL/tabs/calendar?groupId=$groupId"
}
