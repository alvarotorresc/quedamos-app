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
 * Widget «Mejor día»: un único aro grande con el día que más gente de la
 * cuadrilla puede, más una fecha y un texto de estado. Una instancia por
 * appWidgetId, cada una con su propio grupo configurado en [WidgetPrefs].
 */
class MejorDiaWidgetProvider : AppWidgetProvider() {

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
        fun updateAll(ctx: Context) {
            val manager = AppWidgetManager.getInstance(ctx)
            val ids = manager.getAppWidgetIds(ComponentName(ctx, MejorDiaWidgetProvider::class.java))
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
            val views = RemoteViews(ctx.packageName, R.layout.widget_mejor_dia)
            val groupId = WidgetPrefs.widgetGroupId(ctx, appWidgetId)
            val traceColor = ContextCompat.getColor(ctx, R.color.widget_filo)
            val colors = memberColors(ctx)

            // Sin sesión válida (sin token o revocado): estado "abre la app", solo traza.
            val hasSession = WidgetPrefs.token(ctx) != null && !WidgetPrefs.unauthorized(ctx)
            val summary = if (hasSession && groupId != null) WidgetData.load(ctx, groupId) else null

            if (!hasSession || groupId == null) {
                views.setTextViewText(R.id.widget_best_date, "")
                views.setTextViewText(R.id.widget_best_count, ctx.getString(R.string.widget_open_app))
                views.setImageViewBitmap(
                    R.id.widget_best_ring,
                    AroRenderer.render(RING_SIZE_PX, emptyList(), traceColor, colors),
                )
            } else {
                // Con sesión pero sin summary cacheado aún (primer refresh no ha llegado):
                // se trata igual que "sin datos" (bestDay null) — ya hay sesión, solo falta
                // la primera sincronización. Fluye solo por null-safety.
                val bestDay = summary?.bestDay
                val days = summary?.days.orEmpty()
                val dayInWeek = bestDay?.let { bd -> days.firstOrNull { it.date == bd.date } }

                views.setTextViewText(R.id.widget_best_date, bestDateText(bestDay))
                views.setTextViewText(R.id.widget_best_count, bestCountText(ctx, bestDay, days))

                // Limitación consciente (spec §D5 / task 14): el endpoint solo trae
                // availableMemberIds para los días de la semana visible (`days`). Si el
                // mejor día global cae fuera de esa ventana (o aún no hay bestDay) no
                // sabemos quién puede, así que NUNCA inventamos estados — el aro se
                // pinta neutro: todos los miembros conocidos en OFF (ningún arco ON,
                // solo la traza), igual que SemanaWidgetProvider hace para días pasados.
                // Se preserva así el tamaño de la lista de estados (n = nº de miembros),
                // que es lo que determina el grosor del trazo en AroGeometry.strokeWidth
                // — un emptyList() aquí cambiaría ese grosor frente al caso normal.
                // emptyList() se reserva solo para cuando no hay summary en absoluto
                // (sin sesión, o aún sin la primera sincronización): ahí no hay ni
                // miembros que pintar. El texto sigue mostrando la fecha y el count
                // reales de bestDay. El caso común (mejor día dentro de la semana o
                // cercano) trae los datos y pinta los arcos normalmente.
                val states = when {
                    summary == null -> emptyList()
                    bestDay != null && dayInWeek != null ->
                        summary.members.map { m ->
                            m.colorIndex to
                                if (dayInWeek.availableMemberIds.contains(m.id)) AroState.ON else AroState.OFF
                        }
                    else -> summary.members.map { it.colorIndex to AroState.OFF }
                }
                views.setImageViewBitmap(
                    R.id.widget_best_ring,
                    AroRenderer.render(RING_SIZE_PX, states, traceColor, colors),
                )
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
            }

            manager.updateAppWidget(appWidgetId, views)
        }

        /** Fecha del mejor día, ej. «viernes 6» (weekday largo localizado + día del mes). */
        private fun bestDateText(bestDay: WidgetBestDay?): String {
            if (bestDay == null) return ""
            val date = LocalDate.parse(bestDay.date)
            val weekdayLong = date.dayOfWeek.getDisplayName(TextStyle.FULL, Locale.getDefault())
            return "$weekdayLong ${date.dayOfMonth}"
        }

        /** Texto de estado bajo el aro. */
        private fun bestCountText(ctx: Context, bestDay: WidgetBestDay?, days: List<WidgetDay>): String {
            if (bestDay == null) return ctx.getString(R.string.widget_nothing_yet)
            if (bestDay.closesAro) return ctx.getString(R.string.widget_all_can, bestDay.count)

            val date = LocalDate.parse(bestDay.date)
            val weekdayShort = date.dayOfWeek.getDisplayName(TextStyle.SHORT, Locale.getDefault())
            val inWeek = days.any { it.date == bestDay.date }
            val weekdayLabel = if (inWeek) weekdayShort else "$weekdayShort ${date.dayOfMonth}"
            return ctx.getString(R.string.widget_can_count, bestDay.count, weekdayLabel)
        }

        private const val RING_SIZE_PX = 144
    }
}
