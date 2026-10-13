import SwiftUI
import WidgetKit

/// The planner board in a widget: enamel ground, printed events, task washes with an underline.
enum Board {
    static let ground = Color("Board")
    static let ink = Color.primary
    static let muted = Color.secondary

    static func time(_ d: Date) -> String {
        d.formatted(.dateTime.hour(.defaultDigits(amPM: .abbreviated)).minute())
    }
}

/// How one agenda item is drawn: events printed with a left edge, tasks as a wash with an underline; done tasks
/// take the full colour.
struct ItemChip: View {
    let item: AgendaItem
    var compact = false

    var body: some View {
        let done = item.state == "done"
        let wash = item.tint.opacity(item.isTask ? (done ? 1 : 0.18) : 0.12)
        HStack(spacing: 6) {
            if !item.isTask {
                RoundedRectangle(cornerRadius: 1).fill(item.tint).frame(width: 3)
            }
            VStack(alignment: .leading, spacing: 1) {
                Text(item.title)
                    .font(.system(size: compact ? 11 : 12, weight: item.isTask ? .bold : .semibold))
                    .lineLimit(1)
                    .strikethrough(item.state == "missed", color: .secondary)
                if !compact {
                    Text(item.allDay ? "All day" : "\(Board.time(item.start)) – \(Board.time(item.end))")
                        .font(.system(size: 10))
                        .foregroundStyle(done ? AnyShapeStyle(.white.opacity(0.85)) : AnyShapeStyle(.secondary))
                }
            }
            .foregroundStyle(done ? AnyShapeStyle(.white) : AnyShapeStyle(.primary))
            Spacer(minLength: 0)
            if done { Image(systemName: "checkmark").font(.system(size: 10, weight: .bold)).foregroundStyle(.white) }
        }
        .padding(.horizontal, item.isTask ? 7 : 4)
        .padding(.vertical, compact ? 3 : 4)
        .background(wash, in: RoundedRectangle(cornerRadius: 5))
        .overlay(alignment: .bottom) {
            if item.isTask && !done { Rectangle().fill(item.tint).frame(height: 2.5) }
        }
        .clipShape(RoundedRectangle(cornerRadius: 5))
    }
}

/// Shown when the app is signed out or offline.
struct SignedOutView: View {
    let message: String
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Image("Mark").resizable().scaledToFit().frame(width: 16, height: 22)
            Text(message).font(.system(size: 12, weight: .medium)).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .widgetURL(URL(string: "midore://open"))
    }
}
