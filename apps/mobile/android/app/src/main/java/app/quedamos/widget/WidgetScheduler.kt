package app.quedamos.widget

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

object WidgetScheduler {
    private const val PERIODIC = "widget-refresh"
    private const val ONE_TIME = "widget-refresh-now"

    private val network = Constraints.Builder()
        .setRequiredNetworkType(NetworkType.CONNECTED)
        .build()

    fun schedulePeriodic(ctx: Context) {
        val request = PeriodicWorkRequestBuilder<WidgetUpdateWorker>(1, TimeUnit.HOURS)
            .setConstraints(network)
            .build()
        WorkManager.getInstance(ctx)
            .enqueueUniquePeriodicWork(PERIODIC, ExistingPeriodicWorkPolicy.KEEP, request)
    }

    fun refreshNow(ctx: Context) {
        val request = OneTimeWorkRequestBuilder<WidgetUpdateWorker>()
            .setConstraints(network)
            .build()
        WorkManager.getInstance(ctx)
            .enqueueUniqueWork(ONE_TIME, ExistingWorkPolicy.REPLACE, request)
    }

    fun cancelAll(ctx: Context) {
        WorkManager.getInstance(ctx).cancelUniqueWork(PERIODIC)
        WorkManager.getInstance(ctx).cancelUniqueWork(ONE_TIME)
    }
}
