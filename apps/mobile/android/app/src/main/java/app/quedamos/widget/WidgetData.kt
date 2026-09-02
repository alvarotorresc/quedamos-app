package app.quedamos.widget

import android.content.Context
import org.json.JSONObject
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.temporal.TemporalAdjusters

data class WidgetMember(val id: String, val name: String, val colorIndex: Int)
data class WidgetDay(val date: String, val availableMemberIds: List<String>, val hasEvent: Boolean)
data class WidgetBestDay(val date: String, val count: Int, val closesAro: Boolean)
data class WidgetSummary(
    val groupName: String,
    val groupEmoji: String,
    val members: List<WidgetMember>,
    val days: List<WidgetDay>,
    val bestDay: WidgetBestDay?,
)

object WidgetData {
    fun parse(json: String): WidgetSummary? = try {
        val root = JSONObject(json)
        val group = root.getJSONObject("group")
        val members = root.getJSONArray("members").let { arr ->
            (0 until arr.length()).map { i ->
                val m = arr.getJSONObject(i)
                WidgetMember(m.getString("id"), m.getString("name"), m.getInt("colorIndex"))
            }
        }
        val days = root.getJSONArray("days").let { arr ->
            (0 until arr.length()).map { i ->
                val d = arr.getJSONObject(i)
                val ids = d.getJSONArray("availableMemberIds")
                WidgetDay(
                    d.getString("date"),
                    (0 until ids.length()).map { j -> ids.getString(j) },
                    d.getBoolean("hasEvent"),
                )
            }
        }
        val bestDay = root.optJSONObject("bestDay")?.let {
            WidgetBestDay(it.getString("date"), it.getInt("count"), it.getBoolean("closesAro"))
        }
        WidgetSummary(group.getString("name"), group.getString("emoji"), members, days, bestDay)
    } catch (e: Exception) {
        null
    }

    fun load(ctx: Context, groupId: String): WidgetSummary? =
        WidgetPrefs.summaryJson(ctx, groupId)?.let { parse(it) }

    fun mondayOfCurrentWeek(): String =
        LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).toString()

    fun todayKey(): String = LocalDate.now().toString()
}
