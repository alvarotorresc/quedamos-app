package app.quedamos.widget

import android.content.Context
import android.content.SharedPreferences

/** Único canal de datos web → nativo. Claves planas en un SharedPreferences propio. */
object WidgetPrefs {
    private const val FILE = "quedamos_widget"
    private const val KEY_TOKEN = "token"
    private const val KEY_API_URL = "apiUrl"
    private const val KEY_GROUPS = "groupsJson"
    private const val KEY_UNAUTHORIZED = "unauthorized"
    private const val PREFIX_SUMMARY = "summary_"
    private const val PREFIX_WIDGET_GROUP = "widgetGroup_"

    private fun prefs(ctx: Context): SharedPreferences =
        ctx.getSharedPreferences(FILE, Context.MODE_PRIVATE)

    fun token(ctx: Context): String? = prefs(ctx).getString(KEY_TOKEN, null)
    fun apiUrl(ctx: Context): String? = prefs(ctx).getString(KEY_API_URL, null)

    fun setSession(ctx: Context, token: String, apiUrl: String) {
        prefs(ctx).edit()
            .putString(KEY_TOKEN, token)
            .putString(KEY_API_URL, apiUrl)
            .putBoolean(KEY_UNAUTHORIZED, false)
            .apply()
    }

    fun clearAll(ctx: Context) {
        // Las asignaciones widget→grupo sobreviven al logout: al volver a entrar,
        // los widgets ya colocados reviven sin reconfigurarse.
        val editor = prefs(ctx).edit()
        for (key in prefs(ctx).all.keys) {
            if (!key.startsWith(PREFIX_WIDGET_GROUP)) editor.remove(key)
        }
        editor.apply()
    }

    fun groupsJson(ctx: Context): String = prefs(ctx).getString(KEY_GROUPS, "[]") ?: "[]"
    fun setGroupsJson(ctx: Context, json: String) =
        prefs(ctx).edit().putString(KEY_GROUPS, json).apply()

    fun summaryJson(ctx: Context, groupId: String): String? =
        prefs(ctx).getString(PREFIX_SUMMARY + groupId, null)

    fun setSummaryJson(ctx: Context, groupId: String, json: String) =
        prefs(ctx).edit().putString(PREFIX_SUMMARY + groupId, json).apply()

    fun removeSummary(ctx: Context, groupId: String) =
        prefs(ctx).edit().remove(PREFIX_SUMMARY + groupId).apply()

    fun unauthorized(ctx: Context): Boolean = prefs(ctx).getBoolean(KEY_UNAUTHORIZED, false)
    fun setUnauthorized(ctx: Context, value: Boolean) =
        prefs(ctx).edit().putBoolean(KEY_UNAUTHORIZED, value).apply()

    fun widgetGroupId(ctx: Context, appWidgetId: Int): String? =
        prefs(ctx).getString(PREFIX_WIDGET_GROUP + appWidgetId, null)

    fun setWidgetGroupId(ctx: Context, appWidgetId: Int, groupId: String) =
        prefs(ctx).edit().putString(PREFIX_WIDGET_GROUP + appWidgetId, groupId).apply()

    fun removeWidget(ctx: Context, appWidgetId: Int) =
        prefs(ctx).edit().remove(PREFIX_WIDGET_GROUP + appWidgetId).apply()

    fun configuredGroupIds(ctx: Context): Set<String> =
        prefs(ctx).all.entries
            .filter { it.key.startsWith(PREFIX_WIDGET_GROUP) }
            .mapNotNull { it.value as? String }
            .toSet()
}
