package app.quedamos.widget

import android.content.pm.ApplicationInfo
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.net.URI
import java.net.URISyntaxException

@CapacitorPlugin(name = "WidgetBridge")
class WidgetBridgePlugin : Plugin() {

    @PluginMethod
    fun hasSession(call: PluginCall) {
        val result = JSObject()
        result.put("value", WidgetPrefs.token(context) != null && !WidgetPrefs.unauthorized(context))
        call.resolve(result)
    }

    @PluginMethod
    fun setSession(call: PluginCall) {
        val token = call.getString("token")
        val apiUrl = call.getString("apiUrl")
        if (token == null || apiUrl == null) {
            call.reject("token and apiUrl are required")
            return
        }
        if (!isAllowedApiUrl(apiUrl)) {
            call.reject("apiUrl is not allowed")
            return
        }
        WidgetPrefs.setSession(context, token, apiUrl)
        WidgetScheduler.schedulePeriodic(context)
        WidgetScheduler.refreshNow(context)
        call.resolve()
    }

    @PluginMethod
    fun clearSession(call: PluginCall) {
        WidgetPrefs.clearAll(context)
        WidgetScheduler.cancelAll(context)
        SemanaWidgetProvider.updateAll(context)
        MejorDiaWidgetProvider.updateAll(context)
        call.resolve()
    }

    @PluginMethod
    fun setGroups(call: PluginCall) {
        val groups = call.getArray("groups")
        if (groups == null) {
            call.reject("groups is required")
            return
        }
        WidgetPrefs.setGroupsJson(context, groups.toString())
        call.resolve()
    }

    @PluginMethod
    fun refreshWidgets(call: PluginCall) {
        WidgetScheduler.refreshNow(context)
        call.resolve()
    }

    /**
     * El apiUrl llega desde el JS de la webview, y con él se guarda el token del
     * widget: si un script inyectado lo cambiara, el worker mandaría el token a ese
     * servidor en cada refresco. Sólo se acepta el host de producción por https, y
     * los del emulador/dev por http en compilaciones depurables.
     */
    private fun isAllowedApiUrl(url: String): Boolean {
        val parsed = try {
            URI(url)
        } catch (e: URISyntaxException) {
            return false
        }
        val scheme = parsed.scheme?.lowercase() ?: return false
        val host = parsed.host?.lowercase() ?: return false
        if (scheme == "https" && host == API_HOST) return true
        return isDebuggable() && scheme == "http" && host in DEBUG_HOSTS
    }

    private fun isDebuggable(): Boolean =
        (context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0

    companion object {
        private const val API_HOST = "quedamos.api.alvarotc.com"
        private val DEBUG_HOSTS = setOf("10.0.2.2", "localhost")
    }
}
