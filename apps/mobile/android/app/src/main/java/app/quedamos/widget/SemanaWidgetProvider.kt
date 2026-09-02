package app.quedamos.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import androidx.core.content.ContextCompat
import app.quedamos.R
import java.time.LocalDate
import java.time.format.TextStyle
import java.util.Locale

/**
 * Widget «Semana»: fila de 7 mini-aros (L-D) con la disponibilidad de la
 * cuadrilla y un texto inferior que siempre habla del mejor día global
 * (spec §D5). Una instancia por appWidgetId, cada una con su propio grupo
 * configurado en [WidgetPrefs].
 */
class SemanaWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        appWidgetIds.forEach { render(context, appWidgetManager, it) }
    }

    override fun onDeleted(context: Context, appWidgetIds: IntArray) {
        appWidgetIds.forEach { WidgetPrefs.removeWidget(context, it) }
    }

    companion object {
        private val DAY_LETTERS = listOf("L", "M", "X", "J", "V", "S", "D")

        private val CELL_IDS = intArrayOf(
            R.id.widget_day_cell_0,
            R.id.widget_day_cell_1,
            R.id.widget_day_cell_2,
            R.id.widget_day_cell_3,
            R.id.widget_day_cell_4,
            R.id.widget_day_cell_5,
            R.id.widget_day_cell_6,
        )
        private val RING_IDS = intArrayOf(
            R.id.widget_day_ring_0,
            R.id.widget_day_ring_1,
            R.id.widget_day_ring_2,
            R.id.widget_day_ring_3,
            R.id.widget_day_ring_4,
            R.id.widget_day_ring_5,
            R.id.widget_day_ring_6,
        )
        private val LETTER_IDS = intArrayOf(
            R.id.widget_day_letter_0,
            R.id.widget_day_letter_1,
            R.id.widget_day_letter_2,
            R.id.widget_day_letter_3,
            R.id.widget_day_letter_4,
            R.id.widget_day_letter_5,
            R.id.widget_day_letter_6,
        )

        fun updateAll(ctx: Context) {
            val manager = AppWidgetManager.getInstance(ctx)
            val ids = manager.getAppWidgetIds(ComponentName(ctx, SemanaWidgetProvider::class.java))
            ids.forEach { render(ctx, manager, it) }
        }

        private fun memberColors(ctx: Context): IntArray = intArrayOf(
            R.color.member_0,
            R.color.member_1,
            R.color.member_2,
            R.color.member_3,
            R.color.member_4,
            R.color.member_5,
        ).map { ContextCompat.getColor(ctx, it) }.toIntArray()

        private fun render(ctx: Context, manager: AppWidgetManager, appWidgetId: Int) {
            val views = RemoteViews(ctx.packageName, R.layout.widget_semana)
            val groupId = WidgetPrefs.widgetGroupId(ctx, appWidgetId)
            val traceColor = ContextCompat.getColor(ctx, R.color.widget_filo)
            val colors = memberColors(ctx)
            val tintaColor = ContextCompat.getColor(ctx, R.color.widget_tinta)
            val tintaSuaveColor = ContextCompat.getColor(ctx, R.color.widget_tinta_suave)

            // Sin sesión válida (sin token o revocado): estado "abre la app", solo traza.
            val hasSession = WidgetPrefs.token(ctx) != null && !WidgetPrefs.unauthorized(ctx)
            val summary = if (hasSession && groupId != null) WidgetData.load(ctx, groupId) else null

            if (!hasSession || groupId == null) {
                views.setTextViewText(R.id.widget_group_name, "")
                views.setTextViewText(R.id.widget_best_text, ctx.getString(R.string.widget_open_app))
                for (i in 0..6) {
                    views.setImageViewBitmap(
                        RING_IDS[i],
                        AroRenderer.render(RING_SIZE_PX, emptyList(), traceColor, colors),
                    )
                    views.setTextViewText(LETTER_IDS[i], DAY_LETTERS[i])
                }
            } else {
                // Con sesión pero sin summary cacheado aún (primer refresh no ha llegado):
                // se trata igual que "sin datos" (days vacío, bestDay null) en vez de
                // caer al estado "abre la app" — ya hay sesión, solo falta la primera
                // sincronización. Fluye solo por null-safety: no hace falta una rama aparte.
                views.setTextViewText(
                    R.id.widget_group_name,
                    summary?.let { "${it.groupEmoji} ${it.groupName}" } ?: "",
                )

                val today = WidgetData.todayKey()
                val days = summary?.days.orEmpty()

                for (i in 0..6) {
                    val day = days.getOrNull(i)
                    val states = when {
                        day == null -> emptyList()
                        day.date < today -> summary!!.members.map { it.colorIndex to AroState.OFF }
                        else -> summary!!.members.map { m ->
                            m.colorIndex to
                                if (day.availableMemberIds.contains(m.id)) AroState.ON else AroState.OFF
                        }
                    }
                    views.setImageViewBitmap(
                        RING_IDS[i],
                        AroRenderer.render(RING_SIZE_PX, states, traceColor, colors),
                    )
                    views.setTextViewText(LETTER_IDS[i], DAY_LETTERS[i])
                    // Hoy marcado (spec §D5): la letra del día actual en tinta plena,
                    // el resto en tinta suave (color por defecto del layout).
                    views.setTextColor(LETTER_IDS[i], if (day?.date == today) tintaColor else tintaSuaveColor)
                }

                // Parseo único por render: un bestDay.date corrupto se trata como
                // ausente (sin resalte, texto "nada en el aire") en vez de crashear
                // el receiver en cada onUpdate.
                val bestDay = summary?.bestDay
                val bestDayDate = bestDay?.date?.let { runCatching { LocalDate.parse(it) }.getOrNull() }
                val validBestDay = if (bestDayDate != null) bestDay else null
                views.setTextViewText(R.id.widget_best_text, bestDayText(ctx, validBestDay, bestDayDate, days))

                val bestIndex = validBestDay?.let { bd -> days.indexOfFirst { it.date == bd.date } } ?: -1
                if (bestIndex in 0..6) {
                    views.setInt(CELL_IDS[bestIndex], "setBackgroundResource", R.drawable.widget_day_best)
                }
            }

            if (groupId != null) {
                val intent = Intent(
                    Intent.ACTION_VIEW,
                    Uri.parse("https://quedamos-app-mobile.vercel.app/tabs/calendar?groupId=$groupId"),
                ).setPackage(ctx.packageName)
                val pendingIntent = PendingIntent.getActivity(
                    ctx,
                    appWidgetId,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
                )
                views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)
            } else {
                // Sin grupo configurado: el CTA "abre la app" debe abrir la app.
                ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)?.let { launchIntent ->
                    val pendingIntent = PendingIntent.getActivity(
                        ctx,
                        appWidgetId,
                        launchIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
                    )
                    views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)
                }
            }

            manager.updateAppWidget(appWidgetId, views)
        }

        /** Texto inferior siempre referido al mejor día global (spec §D5). */
        private fun bestDayText(
            ctx: Context,
            bestDay: WidgetBestDay?,
            date: LocalDate?,
            days: List<WidgetDay>,
        ): String {
            if (bestDay == null || date == null) return ctx.getString(R.string.widget_nothing_yet)
            return if (bestDay.closesAro) {
                val weekdayLong = date.dayOfWeek.getDisplayName(TextStyle.FULL, Locale.getDefault())
                ctx.getString(R.string.widget_best_day_question, weekdayLong)
            } else {
                val weekdayShort = date.dayOfWeek.getDisplayName(TextStyle.SHORT, Locale.getDefault())
                val inWeek = days.any { it.date == bestDay.date }
                val weekdayLabel = if (inWeek) weekdayShort else "$weekdayShort ${date.dayOfMonth}"
                ctx.getString(R.string.widget_can_count, bestDay.count, weekdayLabel)
            }
        }

        private const val RING_SIZE_PX = 64
    }
}
