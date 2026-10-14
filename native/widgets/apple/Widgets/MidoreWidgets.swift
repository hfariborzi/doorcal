import AppIntents
import SwiftUI
import WidgetKit

// MARK: - Data

/// What every agenda widget renders: the day's items, or why there is nothing to show.
struct AgendaEntry: TimelineEntry {
    let date: Date
    let items: [AgendaItem]
    let problem: String?

    var timed: [AgendaItem] { items.filter { !$0.allDay } }
    var current: AgendaItem? { timed.first { $0.start <= date && $0.end > date } }
    var next: AgendaItem? { timed.first { $0.start > date } }
    var upcoming: [AgendaItem] { items.filter { $0.allDay || $0.end > date } }

    static let sample = AgendaEntry(date: .now, items: [
        AgendaItem(kind: "event", id: "1", taskId: nil, title: "Team standup", start: .now.addingTimeInterval(-1800), end: .now.addingTimeInterval(-600), allDay: false, color: "#4a6a8c", state: nil),
        AgendaItem(kind: "task", id: "2", taskId: 1, title: "Draft Q4 report", start: .now.addingTimeInterval(-600), end: .now.addingTimeInterval(3000), allDay: false, color: "#e11d48", state: "open"),
        AgendaItem(kind: "event", id: "3", taskId: nil, title: "1:1 with Lee", start: .now.addingTimeInterval(3600), end: .now.addingTimeInterval(5400), allDay: false, color: "#557563", state: nil),
        AgendaItem(kind: "task", id: "4", taskId: 2, title: "Gym", start: .now.addingTimeInterval(9000), end: .now.addingTimeInterval(12600), allDay: false, color: "#f5a524", state: "open"),
    ], problem: nil)
}

struct AgendaProvider: TimelineProvider {
    var days = 1

    func placeholder(in context: Context) -> AgendaEntry { .sample }

    func getSnapshot(in context: Context, completion: @escaping (AgendaEntry) -> Void) {
        if context.isPreview { return completion(.sample) }
        Task { completion(await load(at: .now)) }
    }

    /// One entry now and one at every start and end in the next hours, so "now" and "next" stay right between
    /// refreshes. WidgetKit asks again after 15 minutes.
    func getTimeline(in context: Context, completion: @escaping (Timeline<AgendaEntry>) -> Void) {
        Task {
            let first = await load(at: .now)
            let horizon = Date.now.addingTimeInterval(6 * 3600)
            let changes = Set(first.timed.flatMap { [$0.start, $0.end] }.filter { $0 > .now && $0 < horizon }).sorted().prefix(12)
            let entries = [first] + changes.map { AgendaEntry(date: $0, items: first.items, problem: first.problem) }
            completion(Timeline(entries: entries, policy: .after(.now.addingTimeInterval(15 * 60))))
        }
    }

    private func load(at date: Date) async -> AgendaEntry {
        do {
            return AgendaEntry(date: date, items: try await MidoreAPI.agenda(days: days), problem: nil)
        } catch MidoreAPI.Failure.signedOut {
            return AgendaEntry(date: date, items: [], problem: "Open Midore and sign in to see your day here.")
        } catch {
            return AgendaEntry(date: date, items: [], problem: "Can't reach Midore right now.")
        }
    }
}

struct TasksEntry: TimelineEntry {
    let date: Date
    let tasks: [TaskItem]
    let problem: String?
}

struct TasksProvider: TimelineProvider {
    func placeholder(in context: Context) -> TasksEntry {
        TasksEntry(date: .now, tasks: [
            TaskItem(id: 1, title: "Send invoices", dueDate: nil, progress: 0, color: "#e11d48"),
            TaskItem(id: 2, title: "Call mum", dueDate: nil, progress: 0, color: "#557563"),
            TaskItem(id: 3, title: "Review contract", dueDate: nil, progress: 50, color: "#e11d48"),
        ], problem: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (TasksEntry) -> Void) {
        if context.isPreview { return completion(placeholder(in: context)) }
        Task { completion(await load()) }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TasksEntry>) -> Void) {
        Task { completion(Timeline(entries: [await load()], policy: .after(.now.addingTimeInterval(20 * 60)))) }
    }

    private func load() async -> TasksEntry {
        do { return TasksEntry(date: .now, tasks: try await MidoreAPI.tasks(), problem: nil) }
        catch MidoreAPI.Failure.signedOut { return TasksEntry(date: .now, tasks: [], problem: "Open Midore and sign in to see your tasks here.") }
        catch { return TasksEntry(date: .now, tasks: [], problem: "Can't reach Midore right now.") }
    }
}

struct LinkEntry: TimelineEntry {
    let date: Date
    let bookingUrl: String?
}

struct LinkProvider: TimelineProvider {
    func placeholder(in context: Context) -> LinkEntry { LinkEntry(date: .now, bookingUrl: "midore.app/you") }
    func getSnapshot(in context: Context, completion: @escaping (LinkEntry) -> Void) { completion(placeholder(in: context)) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<LinkEntry>) -> Void) {
        Task {
            let me = try? await MidoreAPI.me()
            completion(Timeline(entries: [LinkEntry(date: .now, bookingUrl: me?.bookingUrl)], policy: .after(.now.addingTimeInterval(6 * 3600))))
        }
    }
}

// MARK: - Today

struct TodayView: View {
    @Environment(\.widgetFamily) var family
    let entry: AgendaEntry

    var body: some View {
        if let problem = entry.problem { SignedOutView(message: problem) } else {
            let limit = family == .systemLarge ? 9 : 3
            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .firstTextBaseline) {
                    Text(entry.date.formatted(.dateTime.weekday(.wide))).font(.system(size: 13, weight: .heavy)).textCase(.uppercase).foregroundStyle(Color.vermilion)
                    Text(entry.date.formatted(.dateTime.day().month(.abbreviated))).font(.system(size: 13, weight: .semibold)).foregroundStyle(.secondary)
                    Spacer()
                    Image("Mark").resizable().scaledToFit().frame(width: 10, height: 14)
                }
                if entry.upcoming.isEmpty {
                    Text("Nothing else today.").font(.system(size: 13)).foregroundStyle(.secondary)
                    Spacer(minLength: 0)
                } else {
                    ForEach(entry.upcoming.prefix(limit)) { item in
                        HStack(spacing: 8) {
                            Text(item.allDay ? "all day" : Board.time(item.start))
                                .font(.system(size: 10, weight: .medium).monospacedDigit())
                                .foregroundStyle(item.id == entry.current?.id ? Color.vermilion : .secondary)
                                .frame(width: 52, alignment: .leading)
                            ItemChip(item: item, compact: family != .systemLarge)
                        }
                    }
                    if entry.upcoming.count > limit {
                        Text("+\(entry.upcoming.count - limit) more").font(.system(size: 10)).foregroundStyle(.secondary)
                    }
                    Spacer(minLength: 0)
                }
            }
            .widgetURL(URL(string: "midore://open"))
        }
    }
}

struct TodayWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "app.midore.today", provider: AgendaProvider()) { entry in
            TodayView(entry: entry).containerBackground(Board.ground, for: .widget)
        }
        .configurationDisplayName("Today")
        .description("Your meetings and planned work for the rest of today.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

// MARK: - Now and next

struct NowNextView: View {
    @Environment(\.widgetFamily) var family
    let entry: AgendaEntry

    var body: some View {
        if let problem = entry.problem { SignedOutView(message: problem) } else {
            switch family {
            #if os(iOS)
            case .accessoryInline:
                Text(entry.current.map { "\($0.title) · until \(Board.time($0.end))" } ?? entry.next.map { "Next: \($0.title) \(Board.time($0.start))" } ?? "Nothing else today")
            case .accessoryRectangular:
                VStack(alignment: .leading, spacing: 1) {
                    if let cur = entry.current {
                        Text(cur.title).font(.headline).lineLimit(1)
                        Text("until \(Board.time(cur.end))").font(.caption)
                    } else { Text("Nothing on now").font(.headline) }
                    if let next = entry.next { Text("Next \(Board.time(next.start)) · \(next.title)").font(.caption).lineLimit(1) }
                }
            #endif
            default:
                VStack(alignment: .leading, spacing: 6) {
                    Text("NOW").font(.system(size: 10, weight: .heavy)).foregroundStyle(Color.vermilion)
                    if let cur = entry.current {
                        Text(cur.title).font(.system(size: 15, weight: .bold)).lineLimit(2)
                        ProgressView(timerInterval: cur.start...cur.end, countsDown: true) { EmptyView() } currentValueLabel: { EmptyView() }
                            .tint(cur.tint)
                        Text("until \(Board.time(cur.end))").font(.system(size: 11)).foregroundStyle(.secondary)
                        if cur.isTask, let id = cur.taskId, cur.state == "open" {
                            Button(intent: MarkBlockDoneIntent(taskId: id, start: cur.start, end: cur.end)) {
                                Label("Done", systemImage: "checkmark").font(.system(size: 11, weight: .semibold))
                            }
                            .tint(cur.tint)
                        }
                    } else {
                        Text("Nothing on right now").font(.system(size: 13, weight: .semibold)).foregroundStyle(.secondary)
                    }
                    Spacer(minLength: 0)
                    if let next = entry.next {
                        Text("Next \(Board.time(next.start))").font(.system(size: 10, weight: .semibold)).foregroundStyle(.secondary)
                        Text(next.title).font(.system(size: 12, weight: .semibold)).lineLimit(1)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .widgetURL(URL(string: "midore://open"))
            }
        }
    }
}

struct NowNextWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "app.midore.now", provider: AgendaProvider()) { entry in
            NowNextView(entry: entry).containerBackground(Board.ground, for: .widget)
        }
        .configurationDisplayName("Now and next")
        .description("What's on now, how long is left, and what comes next.")
        #if os(iOS)
        .supportedFamilies([.systemSmall, .accessoryRectangular, .accessoryInline])
        #else
        .supportedFamilies([.systemSmall])
        #endif
    }
}

// MARK: - Tasks

struct TasksView: View {
    @Environment(\.widgetFamily) var family
    let entry: TasksEntry

    var body: some View {
        if let problem = entry.problem { SignedOutView(message: problem) } else {
            let limit = family == .systemLarge ? 10 : 4
            VStack(alignment: .leading, spacing: 7) {
                HStack {
                    Text("TASKS").font(.system(size: 11, weight: .heavy)).foregroundStyle(Color.vermilion)
                    Spacer()
                    Link(destination: URL(string: "midore://quick")!) {
                        Image(systemName: "plus").font(.system(size: 12, weight: .bold)).foregroundStyle(.secondary)
                    }
                }
                if entry.tasks.isEmpty {
                    Text("All clear.").font(.system(size: 13)).foregroundStyle(.secondary)
                }
                ForEach(entry.tasks.prefix(limit)) { task in
                    HStack(spacing: 8) {
                        Button(intent: CompleteTaskIntent(taskId: task.id)) {
                            Image(systemName: "circle").font(.system(size: 15)).foregroundStyle(task.tint)
                        }
                        .buttonStyle(.plain)
                        Text(task.title).font(.system(size: 13, weight: .semibold)).lineLimit(1)
                        Spacer(minLength: 0)
                        if task.progress > 0 { Text("\(task.progress)%").font(.system(size: 10, weight: .medium)).foregroundStyle(.secondary) }
                    }
                }
                Spacer(minLength: 0)
            }
        }
    }
}

struct TasksWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "app.midore.tasks", provider: TasksProvider()) { entry in
            TasksView(entry: entry).containerBackground(Board.ground, for: .widget)
        }
        .configurationDisplayName("Tasks")
        .description("Open tasks, due ones first. Tick one to mark it done.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

// MARK: - This week

struct WeekView: View {
    let entry: AgendaEntry
    private let firstHour = 8.0, lastHour = 20.0

    var body: some View {
        if let problem = entry.problem { SignedOutView(message: problem) } else {
            let cal = Calendar.current
            let start = cal.startOfDay(for: entry.date)
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text("THIS WEEK").font(.system(size: 11, weight: .heavy)).foregroundStyle(Color.vermilion)
                    Spacer()
                    Image("Mark").resizable().scaledToFit().frame(width: 10, height: 14)
                }
                GeometryReader { geo in
                    let colW = geo.size.width / 7
                    let h = geo.size.height - 16
                    ZStack(alignment: .topLeading) {
                        ForEach(0..<7, id: \.self) { d in
                            let day = cal.date(byAdding: .day, value: d, to: start)!
                            Text(day.formatted(.dateTime.weekday(.abbreviated)))
                                .font(.system(size: 9, weight: .bold))
                                .foregroundStyle(d == 0 ? Color.vermilion : .secondary)
                                .offset(x: CGFloat(d) * colW + 2)
                            Rectangle().fill(.secondary.opacity(0.15)).frame(width: 0.5, height: h).offset(x: CGFloat(d) * colW, y: 14)
                        }
                        ForEach(entry.timed) { item in
                            let d = cal.dateComponents([.day], from: start, to: cal.startOfDay(for: item.start)).day ?? 0
                            let s = hours(item.start, cal), e = hours(item.end, cal)
                            if d >= 0 && d < 7 && e > firstHour && s < lastHour {
                                let y = (max(s, firstHour) - firstHour) / (lastHour - firstHour) * h
                                let height = max(3, (min(e, lastHour) - max(s, firstHour)) / (lastHour - firstHour) * h)
                                RoundedRectangle(cornerRadius: 2)
                                    .fill(item.tint.opacity(item.isTask ? (item.state == "done" ? 1 : 0.35) : 0.18))
                                    .overlay(alignment: item.isTask ? .bottom : .leading) {
                                        if item.isTask { Rectangle().fill(item.tint).frame(height: 1.5) } else { Rectangle().fill(item.tint).frame(width: 2) }
                                    }
                                    .frame(width: colW - 4, height: height)
                                    .offset(x: CGFloat(d) * colW + 2, y: 14 + y)
                            }
                        }
                    }
                }
            }
            .widgetURL(URL(string: "midore://open"))
        }
    }

    private func hours(_ date: Date, _ cal: Calendar) -> Double {
        let c = cal.dateComponents([.hour, .minute], from: date)
        return Double(c.hour ?? 0) + Double(c.minute ?? 0) / 60
    }
}

struct WeekWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "app.midore.week", provider: AgendaProvider(days: 7)) { entry in
            WeekView(entry: entry).containerBackground(Board.ground, for: .widget)
        }
        .configurationDisplayName("This week")
        .description("The next seven days on the board: meetings printed, planned work in colour.")
        #if os(macOS)
        .supportedFamilies([.systemLarge, .systemExtraLarge])
        #else
        .supportedFamilies([.systemLarge])
        #endif
    }
}

// MARK: - Ask Dori and booking link

struct AskDoriWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "app.midore.dori", provider: LinkProvider()) { _ in
            VStack(alignment: .leading, spacing: 4) {
                Image("Dori").resizable().scaledToFit().frame(maxHeight: 70)
                Spacer(minLength: 0)
                Text("Ask Dori").font(.system(size: 15, weight: .bold))
                Text("Add a task or empty your head").font(.system(size: 11)).foregroundStyle(.secondary).lineLimit(2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .widgetURL(URL(string: "midore://quick"))
            .containerBackground(Board.ground, for: .widget)
        }
        .configurationDisplayName("Ask Dori")
        .description("Open quick add: add a task or tell Dori what's on your mind.")
        .supportedFamilies([.systemSmall])
    }
}

struct BookingWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "app.midore.booking", provider: LinkProvider()) { entry in
            VStack(alignment: .leading, spacing: 4) {
                Image(systemName: "link").font(.system(size: 18, weight: .semibold)).foregroundStyle(Color.vermilion)
                Spacer(minLength: 0)
                Text("Your booking link").font(.system(size: 13, weight: .bold))
                Text(entry.bookingUrl.map { $0.replacingOccurrences(of: "https://", with: "") } ?? "Sign in to Midore")
                    .font(.system(size: 11)).foregroundStyle(.secondary).lineLimit(2)
                Text("Tap to copy").font(.system(size: 10, weight: .semibold)).foregroundStyle(Color.vermilion)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .widgetURL(URL(string: "midore://copy-link"))
            .containerBackground(Board.ground, for: .widget)
        }
        .configurationDisplayName("Booking link")
        .description("Your booking link, one tap to copy.")
        .supportedFamilies([.systemSmall])
    }
}

@main
struct MidoreWidgetBundle: WidgetBundle {
    var body: some Widget {
        TodayWidget()
        NowNextWidget()
        TasksWidget()
        WeekWidget()
        AskDoriWidget()
        BookingWidget()
        #if os(iOS)
        MidoreLiveActivity()
        #endif
    }
}
