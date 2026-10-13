package app.midore.widgets

import android.app.Activity
import android.content.Context
import android.content.Intent
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin

@InvokeArg
class SessionArgs {
    var token: String? = null
    var baseUrl: String = ""
}

/**
 * Shares the device token and server address with Midore's home-screen widgets (they live in the app module, see
 * native/widgets/android) and asks them to refresh.
 */
@TauriPlugin
class WidgetsPlugin(private val activity: Activity) : Plugin(activity) {
    @Command
    fun setSession(invoke: Invoke) {
        val args = invoke.parseArgs(SessionArgs::class.java)
        activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().apply {
            if (args.token != null) putString("token", args.token) else remove("token")
            putString("baseUrl", args.baseUrl)
        }.apply()
        activity.sendBroadcast(Intent(REFRESH).setPackage(activity.packageName))
        invoke.resolve()
    }

    companion object {
        const val PREFS = "midore_widgets"
        const val REFRESH = "app.midore.widgets.REFRESH"
    }
}
