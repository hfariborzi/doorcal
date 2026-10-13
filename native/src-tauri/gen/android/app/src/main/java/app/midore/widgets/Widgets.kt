package app.midore.widgets

import app.midore.R

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ClipData
import android.content.ClipboardManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import android.widget.Toast
import java.time.OffsetDateTime
import kotlin.concurrent.thread

/** Shared plumbing: refresh on the app's broadcast, open the app with a midore:// link, run work off the main thread. */
abstract class MidoreWidget : AppWidgetProvider() {
    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == WidgetsPlugin.REFRESH) refresh(context)
    }

    fun refresh(context: Context) {
        val mgr = AppWidgetManager.getInstance(context)
        val ids = mgr.getAppWidgetIds(ComponentName(context, javaClass))
        if (ids.isNotEmpty()) onUpdate(context, mgr, ids)
    }

    /** Do network work in the background; the system keeps the receiver alive until `done`. */
    protected fun background(work: () -> Unit) {
        val pending = goAsync()
        thread {
            try {
                work()
            } catch (_: Exception) {
            } finally {
                pending.finish()
            }
        }
    }

    companion object {
        fun openApp(ctx: Context, path: String = "open"): PendingIntent {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse("midore://$path")).setPackage(ctx.packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            return PendingIntent.getActivity(ctx, path.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        }

        fun signedOutText(ctx: Context) = if (MidoreApi.signedIn(ctx)) "Can't reach Midore right now." else "Open Midore and sign in to see your day here."
    }
}

/** Today: the rest of the day's meetings and planned work, as a list. */
class TodayWidget : MidoreWidget() {
    override fun onUpdate(context: Context, mgr: AppWidgetManager, ids: IntArray) {
        for (id in ids) {
            val views = RemoteViews(context.packageName, R.layout.midore_widget_list)
            views.setTextViewText(R.id.title, java.time.LocalDate.now().format(java.time.format.DateTimeFormatter.ofPattern("EEEE · MMM d")))
            val svc = Intent(context, AgendaService::class.java).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id)
            svc.data = Uri.parse(svc.toUri(Intent.URI_INTENT_SCHEME))
            views.setRemoteAdapter(R.id.list, svc)
            views.setEmptyView(R.id.list, R.id.empty)
            views.setTextViewText(R.id.empty, if (MidoreApi.signedIn(context)) "Nothing else today." else signedOutText(context))
            views.setOnClickPendingIntent(R.id.root, openApp(context))
            views.setPendingIntentTemplate(R.id.list, openApp(context))
            views.setViewVisibility(R.id.add, View.GONE)
            mgr.updateAppWidget(id, views)
        }
        mgr.notifyAppWidgetViewDataChanged(ids, R.id.list)
    }
}

/** Now and next: what's on, until when, and what comes after. */
class NowNextWidget : MidoreWidget() {
    override fun onUpdate(context: Context, mgr: AppWidgetManager, ids: IntArray) {
        background {
            val views = RemoteViews(context.packageName, R.layout.midore_widget_now)
            views.setOnClickPendingIntent(R.id.root, openApp(context))
            try {
                val now = OffsetDateTime.now()
                val timed = MidoreApi.agenda(context).filter { !it.allDay && it.start != null && it.end != null }
                val cur = timed.firstOrNull { it.start!! <= now && it.end!! > now }
                val next = timed.firstOrNull { it.start!! > now }
                views.setTextViewText(R.id.now_title, cur?.title ?: "Nothing on right now")
                views.setTextViewText(R.id.now_until, if (cur != null) "until ${MidoreApi.clock(cur.end)}" else "")
                views.setInt(R.id.now_bar, "setBackgroundColor", cur?.color ?: 0x00000000)
                views.setTextViewText(R.id.next_line, if (next != null) "Next ${MidoreApi.clock(next.start)} · ${next.title}" else "Nothing else today")
            } catch (e: Exception) {
                views.setTextViewText(R.id.now_title, signedOutText(context))
                views.setTextViewText(R.id.now_until, "")
                views.setTextViewText(R.id.next_line, "")
            }
            mgr.updateAppWidget(ids, views)
        }
    }
}

/** Tasks: open tasks, due ones first. The circle marks one done. */
class TasksWidget : MidoreWidget() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == COMPLETE) {
            val id = intent.getLongExtra(EXTRA_TASK, -1)
            if (id > 0) background {
                MidoreApi.complete(context, id)
                refresh(context)
            }
            return
        }
        super.onReceive(context, intent)
    }

    override fun onUpdate(context: Context, mgr: AppWidgetManager, ids: IntArray) {
        for (id in ids) {
            val views = RemoteViews(context.packageName, R.layout.midore_widget_list)
            views.setTextViewText(R.id.title, "TASKS")
            val svc = Intent(context, TasksService::class.java).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id)
            svc.data = Uri.parse(svc.toUri(Intent.URI_INTENT_SCHEME))
            views.setRemoteAdapter(R.id.list, svc)
            views.setEmptyView(R.id.list, R.id.empty)
            views.setTextViewText(R.id.empty, if (MidoreApi.signedIn(context)) "All clear." else signedOutText(context))
            val complete = Intent(context, TasksWidget::class.java).setAction(COMPLETE)
            views.setPendingIntentTemplate(R.id.list, PendingIntent.getBroadcast(context, 7, complete, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE))
            views.setViewVisibility(R.id.add, View.VISIBLE)
            views.setOnClickPendingIntent(R.id.add, openApp(context, "quick"))
            views.setOnClickPendingIntent(R.id.title, openApp(context))
            mgr.updateAppWidget(id, views)
        }
        mgr.notifyAppWidgetViewDataChanged(ids, R.id.list)
    }

    companion object {
        const val COMPLETE = "app.midore.widgets.COMPLETE"
        const val EXTRA_TASK = "taskId"
    }
}

/** Ask Dori: opens Midore ready for a brain dump. */
class DoriWidget : MidoreWidget() {
    override fun onUpdate(context: Context, mgr: AppWidgetManager, ids: IntArray) {
        val views = RemoteViews(context.packageName, R.layout.midore_widget_dori)
        views.setOnClickPendingIntent(R.id.root, openApp(context, "quick"))
        mgr.updateAppWidget(ids, views)
    }
}

/** Booking link: shows it, and copies it on tap. */
class BookingWidget : MidoreWidget() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == COPY) {
            val link = context.getSharedPreferences(WidgetsPlugin.PREFS, Context.MODE_PRIVATE).getString("bookingUrl", null)
            if (link != null) {
                val clip = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                clip.setPrimaryClip(ClipData.newPlainText("Midore booking link", link))
                Toast.makeText(context, "Booking link copied", Toast.LENGTH_SHORT).show()
            }
            return
        }
        super.onReceive(context, intent)
    }

    override fun onUpdate(context: Context, mgr: AppWidgetManager, ids: IntArray) {
        background {
            val link = try { MidoreApi.bookingUrl(context) } catch (_: Exception) { null }
            if (link != null) context.getSharedPreferences(WidgetsPlugin.PREFS, Context.MODE_PRIVATE).edit().putString("bookingUrl", link).apply()
            val views = RemoteViews(context.packageName, R.layout.midore_widget_booking)
            views.setTextViewText(R.id.link, link?.removePrefix("https://") ?: signedOutText(context))
            val copy = Intent(context, BookingWidget::class.java).setAction(COPY)
            views.setOnClickPendingIntent(R.id.root, PendingIntent.getBroadcast(context, 9, copy, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
            mgr.updateAppWidget(ids, views)
        }
    }

    companion object {
        const val COPY = "app.midore.widgets.COPY"
    }
}
