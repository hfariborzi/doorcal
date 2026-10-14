#if os(iOS)
import ActivityKit
import SwiftUI
import WidgetKit

/// The Live Activity: the event or planned work that's on now, with time left, on the Lock Screen and in the
/// Dynamic Island. The countdown runs on its own; the app replaces it when the next thing starts.
struct MidoreLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: MidoreActivityAttributes.self) { context in
            LockScreenActivity(state: context.state, stale: context.isStale)
                .activityBackgroundTint(Color("Board"))
                .activitySystemActionForegroundColor(.primary)
        } dynamicIsland: { context in
            let s = context.state
            let tint = Color(hex: s.color)
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label(s.kind == "task" ? "Planned" : "Now", systemImage: s.kind == "task" ? "checklist" : "calendar")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(tint)
                        .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(timerInterval: s.start...s.end, countsDown: true)
                        .font(.title3.weight(.semibold).monospacedDigit())
                        .multilineTextAlignment(.trailing)
                        .frame(maxWidth: 90)
                        .padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(s.title).font(.headline).lineLimit(1)
                        ProgressView(timerInterval: s.start...s.end, countsDown: false) { EmptyView() } currentValueLabel: { EmptyView() }
                            .tint(tint)
                        if let next = s.nextTitle, let at = s.nextStart {
                            Text("Next: \(next) · \(at, style: .time)").font(.caption).foregroundStyle(.secondary).lineLimit(1)
                        }
                    }
                    .padding(.horizontal, 4)
                }
            } compactLeading: {
                RoundedRectangle(cornerRadius: 3).fill(tint).frame(width: 10, height: 14)
            } compactTrailing: {
                Text(timerInterval: s.start...s.end, countsDown: true)
                    .monospacedDigit()
                    .font(.caption2.weight(.semibold))
                    .frame(maxWidth: 42)
            } minimal: {
                ProgressView(timerInterval: s.start...s.end, countsDown: true) { EmptyView() } currentValueLabel: { EmptyView() }
                    .progressViewStyle(.circular)
                    .tint(tint)
            }
            .widgetURL(URL(string: "midore://open"))
            .keylineTint(tint)
        }
    }
}

private struct LockScreenActivity: View {
    let state: MidoreActivityAttributes.ContentState
    let stale: Bool

    var body: some View {
        let tint = Color(hex: state.color)
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .center, spacing: 12) {
                RoundedRectangle(cornerRadius: 2).fill(tint).frame(width: 4, height: 38)
                VStack(alignment: .leading, spacing: 2) {
                    Text(state.title).font(.headline).lineLimit(1)
                    Text(stale ? "Ended" : "Until \(state.end.formatted(date: .omitted, time: .shortened))")
                        .font(.subheadline).foregroundStyle(.secondary)
                }
                Spacer(minLength: 8)
                if !stale {
                    Text(timerInterval: state.start...state.end, countsDown: true)
                        .font(.title2.weight(.semibold).monospacedDigit())
                        .multilineTextAlignment(.trailing)
                        .frame(maxWidth: 110, alignment: .trailing)
                }
            }
            ProgressView(timerInterval: state.start...state.end, countsDown: false) { EmptyView() } currentValueLabel: { EmptyView() }
                .tint(tint)
            if let next = state.nextTitle, let at = state.nextStart {
                Text("Next: \(next) · \(at, style: .time)").font(.caption).foregroundStyle(.secondary).lineLimit(1)
            }
        }
        .padding(16)
    }
}
#endif
