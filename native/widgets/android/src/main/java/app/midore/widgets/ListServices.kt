package app.midore.widgets

import app.midore.R

import android.content.Context
import android.content.Intent
import android.graphics.Paint
import android.view.View
import android.widget.RemoteViews
import android.widget.RemoteViewsService
import java.time.OffsetDateTime

/** Rows for the Today widget. Runs on a binder thread, so the network call is allowed here. */
class AgendaService : RemoteViewsService() {
    override fun onGetViewFactory(intent: Intent): RemoteViewsFactory = AgendaFactory(applicationContext)
}

class AgendaFactory(private val ctx: Context) : RemoteViewsService.RemoteViewsFactory {
    private var items: List<AgendaItem> = emptyList()

    override fun onDataSetChanged() {
        val now = OffsetDateTime.now()
        items = try {
            MidoreApi.agenda(ctx).filter { it.allDay || (it.end?.isAfter(now) ?: true) }
        } catch (_: Exception) {
            emptyList()
        }
    }

    override fun getViewAt(position: Int): RemoteViews {
        val item = items[position]
        val row = RemoteViews(ctx.packageName, R.layout.midore_widget_row)
        row.setTextViewText(R.id.time, if (item.allDay) "all day" else MidoreApi.clock(item.start))
        row.setTextViewText(R.id.row_title, item.title)
        row.setTextViewText(R.id.row_sub, if (item.allDay) "" else "until ${MidoreApi.clock(item.end)}")
        // Events carry their colour on the left; tasks underneath (see DESIGN.md).
        row.setInt(R.id.edge, "setBackgroundColor", if (item.isTask) 0 else item.color)
        row.setInt(R.id.underline, "setBackgroundColor", if (item.isTask) item.color else 0)
        val done = item.state == "done"
        row.setInt(R.id.row_title, "setPaintFlags", if (item.state == "missed") Paint.STRIKE_THRU_TEXT_FLAG or Paint.ANTI_ALIAS_FLAG else Paint.ANTI_ALIAS_FLAG)
        row.setViewVisibility(R.id.check, if (done) View.VISIBLE else View.GONE)
        row.setViewVisibility(R.id.check_button, View.GONE)
        row.setOnClickFillInIntent(R.id.row_root, Intent())
        return row
    }

    override fun getCount() = items.size
    override fun onCreate() {}
    override fun onDestroy() {}
    override fun getLoadingView(): RemoteViews? = null
    override fun getViewTypeCount() = 1
    override fun getItemId(position: Int) = position.toLong()
    override fun hasStableIds() = false
}

/** Rows for the Tasks widget, each with a circle that marks the task done. */
class TasksService : RemoteViewsService() {
    override fun onGetViewFactory(intent: Intent): RemoteViewsFactory = TasksFactory(applicationContext)
}

class TasksFactory(private val ctx: Context) : RemoteViewsService.RemoteViewsFactory {
    private var tasks: List<TaskItem> = emptyList()

    override fun onDataSetChanged() {
        tasks = try {
            MidoreApi.tasks(ctx)
        } catch (_: Exception) {
            emptyList()
        }
    }

    override fun getViewAt(position: Int): RemoteViews {
        val task = tasks[position]
        val row = RemoteViews(ctx.packageName, R.layout.midore_widget_row)
        row.setViewVisibility(R.id.time, View.GONE)
        row.setTextViewText(R.id.row_title, task.title)
        row.setTextViewText(R.id.row_sub, if (task.progress > 0) "${task.progress}% done" else "")
        row.setInt(R.id.edge, "setBackgroundColor", 0)
        row.setInt(R.id.underline, "setBackgroundColor", task.color)
        row.setViewVisibility(R.id.check, View.GONE)
        row.setViewVisibility(R.id.check_button, View.VISIBLE)
        row.setInt(R.id.check_button, "setColorFilter", task.color)
        row.setOnClickFillInIntent(R.id.check_button, Intent().putExtra(TasksWidget.EXTRA_TASK, task.id))
        return row
    }

    override fun getCount() = tasks.size
    override fun onCreate() {}
    override fun onDestroy() {}
    override fun getLoadingView(): RemoteViews? = null
    override fun getViewTypeCount() = 1
    override fun getItemId(position: Int) = tasks[position].id
    override fun hasStableIds() = true
}
