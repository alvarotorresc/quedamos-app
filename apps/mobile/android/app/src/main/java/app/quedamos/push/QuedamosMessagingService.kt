package app.quedamos.push

import android.util.Log
import app.quedamos.widget.WidgetScheduler
import com.capacitorjs.plugins.pushnotifications.MessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * El servicio de FCM de la app.
 *
 * Extiende el del plugin de Capacitor en vez de sustituirlo: todo lo que no sea un
 * `widget_refresh` sigue su camino de siempre por `super.onMessageReceived`, y
 * `onNewToken` se hereda sin tocar, así que el plugin sigue recibiendo el token rotado
 * igual que antes.
 *
 * Lo único que intercepta es el refresco de los widgets, que NO se propaga: si llegara
 * al plugin, éste lo entregaría a la webview y (con la app en primer plano) acabaría
 * dibujando algo. Aquí no se dibuja nada; se encola el trabajo que relee el grupo y se
 * vuelve.
 */
class QuedamosMessagingService : MessagingService() {

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        if (WidgetRefreshPush.isWidgetRefresh(remoteMessage.data)) {
            Log.d(TAG, "widget_refresh recibido: refrescando los widgets")
            WidgetScheduler.refreshNow(applicationContext)
            return
        }

        super.onMessageReceived(remoteMessage)
    }

    private companion object {
        const val TAG = "QuedamosMessaging"
    }
}
