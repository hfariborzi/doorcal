import AppIntents
import WidgetKit

/// Tick a task done right in the Tasks widget.
struct CompleteTaskIntent: AppIntent {
    static var title: LocalizedStringResource = "Mark task done"
    static var isDiscoverable = false

    @Parameter(title: "Task") var taskId: Int

    init() {}
    init(taskId: Int) { self.taskId = taskId }

    func perform() async throws -> some IntentResult {
        try? await MidoreAPI.setStatus(task: taskId, status: "done")
        return .result()
    }
}

/// Mark the planned block that is on now as done, from the Now and next widget.
struct MarkBlockDoneIntent: AppIntent {
    static var title: LocalizedStringResource = "Mark this block done"
    static var isDiscoverable = false

    @Parameter(title: "Task") var taskId: Int
    @Parameter(title: "Start") var start: Date
    @Parameter(title: "End") var end: Date

    init() {}
    init(taskId: Int, start: Date, end: Date) {
        self.taskId = taskId
        self.start = start
        self.end = end
    }

    func perform() async throws -> some IntentResult {
        try? await MidoreAPI.markBlock(task: taskId, start: start, end: end, status: "done")
        return .result()
    }
}
