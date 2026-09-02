package app.quedamos.widget

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL

class WidgetUpdateWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val ctx = applicationContext
        val token = WidgetPrefs.token(ctx)
        val apiUrl = WidgetPrefs.apiUrl(ctx)
        val groupIds = WidgetPrefs.configuredGroupIds(ctx)

        if (token != null && apiUrl != null) {
            for (groupId in groupIds) {
                fetchSummary(apiUrl, token, groupId)?.let { (status, body) ->
                    when {
                        status in 200..299 && body != null && WidgetData.parse(body) != null -> {
                            WidgetPrefs.setSummaryJson(ctx, groupId, body)
                            WidgetPrefs.setUnauthorized(ctx, false)
                        }
                        status == 401 -> WidgetPrefs.setUnauthorized(ctx, true)
                        // otros fallos: se conserva el último snapshot
                        else -> {}
                    }
                }
            }
        }

        // Siempre repintar: aunque la red falle, la ventana de "hoy" avanza.
        SemanaWidgetProvider.updateAll(ctx)
        MejorDiaWidgetProvider.updateAll(ctx)
        return Result.success()
    }

    private suspend fun fetchSummary(
        apiUrl: String,
        token: String,
        groupId: String,
    ): Pair<Int, String?>? = withContext(Dispatchers.IO) {
        try {
            val url = URL(
                "$apiUrl/widget/summary?groupId=$groupId" +
                    "&weekStart=${WidgetData.mondayOfCurrentWeek()}&today=${WidgetData.todayKey()}",
            )
            val conn = url.openConnection() as HttpURLConnection
            conn.connectTimeout = 10_000
            conn.readTimeout = 10_000
            conn.setRequestProperty("Authorization", "Bearer $token")
            try {
                val status = conn.responseCode
                val body = if (status in 200..299) {
                    conn.inputStream.bufferedReader().use { it.readText() }
                } else null
                status to body
            } finally {
                conn.disconnect()
            }
        } catch (e: Exception) {
            null // red caída: conservar snapshot
        }
    }
}
