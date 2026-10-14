package app.midore.widgets

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.content.res.Configuration
import android.os.Bundle
import android.text.InputType
import android.view.WindowManager
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.Toast
import kotlin.concurrent.thread

/**
 * Quick add, without opening the app: from "Share" in any app (text or a link becomes a task), the "Add a task"
 * shortcut on the app icon, and the Tasks widget's add button. Midore plans the task into the week.
 */
class QuickAddActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!MidoreApi.signedIn(this)) {
            Toast.makeText(this, "Open Midore and sign in first.", Toast.LENGTH_LONG).show()
            packageManager.getLaunchIntentForPackage(packageName)?.let { startActivity(it) }
            finish()
            return
        }
        val dark = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
        val theme = if (dark) android.R.style.Theme_DeviceDefault_Dialog_Alert else android.R.style.Theme_DeviceDefault_Light_Dialog_Alert
        val pad = (20 * resources.displayMetrics.density).toInt()
        val input = EditText(this).apply {
            setText(sharedText(intent))
            hint = "What to do"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES or InputType.TYPE_TEXT_FLAG_MULTI_LINE
            minLines = 1
            maxLines = 6
            setSelection(text.length)
        }
        val box = FrameLayout(this).apply {
            setPadding(pad, pad / 2, pad, 0)
            addView(input)
        }
        val dialog = AlertDialog.Builder(this, theme)
            .setTitle("Add to Midore")
            .setView(box)
            .setPositiveButton("Add", null)
            .setNegativeButton("Cancel") { _, _ -> finish() }
            .setOnCancelListener { finish() }
            .create()
        dialog.setOnShowListener {
            val add = dialog.getButton(AlertDialog.BUTTON_POSITIVE)
            add.setOnClickListener {
                val title = input.text.toString().trim().take(300)
                if (title.isEmpty()) return@setOnClickListener
                add.isEnabled = false
                thread {
                    val message = try {
                        MidoreApi.addTask(this, title)
                        null
                    } catch (e: MidoreApi.SignedOut) {
                        "Open Midore and sign in first."
                    } catch (e: Exception) {
                        "Couldn't reach Midore. Try again in a moment."
                    }
                    runOnUiThread {
                        if (message == null) {
                            Toast.makeText(this, "Added. Midore will fit it into your week.", Toast.LENGTH_SHORT).show()
                            sendBroadcast(Intent(WidgetsPlugin.REFRESH).setPackage(packageName))
                            dialog.dismiss()
                            finish()
                        } else {
                            Toast.makeText(this, message, Toast.LENGTH_LONG).show()
                            add.isEnabled = true
                        }
                    }
                }
            }
        }
        dialog.window?.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_VISIBLE)
        dialog.show()
        input.requestFocus()
    }

    /** Shared text and link as one title: "Article title https://…". */
    private fun sharedText(intent: Intent?): String {
        if (intent?.action != Intent.ACTION_SEND) return ""
        val subject = intent.getStringExtra(Intent.EXTRA_SUBJECT)?.trim().orEmpty()
        val text = intent.getStringExtra(Intent.EXTRA_TEXT)?.trim().orEmpty()
        val joined = if (subject.isEmpty() || text.contains(subject)) text else "$subject $text"
        return joined.trim().take(300)
    }
}
