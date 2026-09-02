package app.quedamos.widget

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "WidgetBridge")
class WidgetBridgePlugin : Plugin() {

    @PluginMethod
    fun hasSession(call: PluginCall) {
        val result = JSObject()
        result.put("value", WidgetPrefs.token(context) != null)
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
}
