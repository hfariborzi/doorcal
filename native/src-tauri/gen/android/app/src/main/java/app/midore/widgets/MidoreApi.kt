package app.midore.widgets

import android.content.Context
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/** One thing on the day: a calendar event or a planned task block. */
data class AgendaItem(
    val kind: String,
    val taskId: Long?,
    val title: String,
    val start: OffsetDateTime?,
    val end: OffsetDateTime?,
    val allDay: Boolean,
    val color: Int,
    val state: String?,
) {
    val isTask get() = kind == "task"
}

data class TaskItem(val id: Long, val title: String, val progress: Int, val color: Int)

/**
 * Calls Midore's /api/v1 with the device token the app shares (see WidgetsPlugin.setSession). Runs off the main
 * thread only: widget updates call it from goAsync() threads and list factories.
 */
object MidoreApi {
    class SignedOut : Exception()

    private fun session(ctx: Context): Pair<String, String>? {
        val p = ctx.getSharedPreferences(WidgetsPlugin.PREFS, Context.MODE_PRIVATE)
        val token = p.getString("token", null) ?: return null
        val base = p.getString("baseUrl", null) ?: return null
        return base to token
    }

    fun signedIn(ctx: Context) = session(ctx) != null

    private fun call(ctx: Context, path: String, method: String = "GET", body: JSONObject? = null): JSONObject {
        val (base, token) = session(ctx) ?: throw SignedOut()
        val conn = URL(base + path).openConnection() as HttpURLConnection
        conn.requestMethod = method
        conn.connectTimeout = 15000
        conn.readTimeout = 20000
        conn.setRequestProperty("Authorization", "Bearer $token")
        if (body != null) {
            conn.doOutput = true
            conn.setRequestProperty("Content-Type", "application/json")
            conn.outputStream.use { it.write(body.toString().toByteArray()) }
        }
        try {
            if (conn.responseCode == 401) throw SignedOut()
            val text = (if (conn.responseCode in 200..299) conn.inputStream else conn.errorStream)?.bufferedReader()?.use { it.readText() } ?: "{}"
            if (conn.responseCode !in 200..299) throw IllegalStateException("HTTP ${conn.responseCode}")
            return JSONObject(text)
        } finally {
            conn.disconnect()
        }
    }

    private fun time(s: String?): OffsetDateTime? = try {
        if (s == null) null else OffsetDateTime.parse(s)
    } catch (e: Exception) {
        null
    }

    private fun color(hex: String?): Int = try {
        android.graphics.Color.parseColor(hex ?: "#e11d48")
    } catch (e: Exception) {
        android.graphics.Color.parseColor("#e11d48")
    }

    fun agenda(ctx: Context, days: Int = 1): List<AgendaItem> {
        val items = call(ctx, "/api/v1/agenda?days=$days").getJSONArray("items")
        return (0 until items.length()).map { i ->
            val o = items.getJSONObject(i)
            AgendaItem(
                kind = o.getString("kind"),
                taskId = if (o.has("taskId") && !o.isNull("taskId")) o.getLong("taskId") else null,
                title = o.getString("title"),
                start = time(o.optString("start")),
                end = time(o.optString("end")),
                allDay = o.optBoolean("allDay"),
                color = color(o.optString("color")),
                state = if (o.has("state") && !o.isNull("state")) o.getString("state") else null,
            )
        }
    }

    fun tasks(ctx: Context): List<TaskItem> {
        val list = call(ctx, "/api/v1/tasks").getJSONArray("tasks")
        return (0 until list.length()).map { i ->
            val o = list.getJSONObject(i)
            TaskItem(o.getLong("id"), o.getString("title"), o.optInt("progress"), color(o.optString("color")))
        }
    }

    fun bookingUrl(ctx: Context): String? = call(ctx, "/api/v1/me").optString("bookingUrl").ifEmpty { null }

    /** Quick add (share target, shortcut, Tasks widget). Midore plans it into the week. */
    fun addTask(ctx: Context, title: String) {
        call(ctx, "/api/v1/tasks", "POST", JSONObject().put("title", title))
    }

    fun complete(ctx: Context, taskId: Long) {
        call(ctx, "/api/v1/tasks/$taskId/status", "POST", JSONObject().put("status", "done"))
    }

    private val clock = DateTimeFormatter.ofPattern("h:mm a")
    fun clock(t: OffsetDateTime?): String = t?.atZoneSameInstant(ZoneId.systemDefault())?.format(clock)?.lowercase() ?: ""
}
