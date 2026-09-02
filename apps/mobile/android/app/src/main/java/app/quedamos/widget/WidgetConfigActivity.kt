package app.quedamos.widget

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Bundle
import android.widget.ArrayAdapter
import android.widget.ListView
import android.widget.TextView
import org.json.JSONArray
import app.quedamos.R

class WidgetConfigActivity : Activity() {

    private var appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setResult(RESULT_CANCELED)
        setContentView(R.layout.widget_config)

        appWidgetId = intent?.extras?.getInt(
            AppWidgetManager.EXTRA_APPWIDGET_ID,
            AppWidgetManager.INVALID_APPWIDGET_ID,
        ) ?: AppWidgetManager.INVALID_APPWIDGET_ID
        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish()
            return
        }

        val groups = parseGroups(WidgetPrefs.groupsJson(this))
        val list = findViewById<ListView>(R.id.config_list)
        val empty = findViewById<TextView>(R.id.config_empty)

        if (groups.isEmpty()) {
            empty.visibility = android.view.View.VISIBLE
            list.visibility = android.view.View.GONE
            return
        }

        // Un solo grupo: se elige solo, sin pantalla (spec: auto-seleccionado).
        if (groups.size == 1) {
            confirm(groups[0].first)
            return
        }

        list.adapter = ArrayAdapter(
            this,
            R.layout.widget_config_row,
            groups.map { "${it.third} ${it.second}" },
        )
        list.setOnItemClickListener { _, _, position, _ -> confirm(groups[position].first) }
    }

    /** Triple(id, name, emoji) */
    private fun parseGroups(json: String): List<Triple<String, String, String>> = try {
        val arr = JSONArray(json)
        (0 until arr.length()).map { i ->
            val g = arr.getJSONObject(i)
            Triple(g.getString("id"), g.getString("name"), g.optString("emoji", ""))
        }
    } catch (e: Exception) {
        emptyList()
    }

    private fun confirm(groupId: String) {
        WidgetPrefs.setWidgetGroupId(this, appWidgetId, groupId)
        WidgetScheduler.schedulePeriodic(this)
        WidgetScheduler.refreshNow(this)
        val result = Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
        setResult(RESULT_OK, result)
        finish()
    }
}
