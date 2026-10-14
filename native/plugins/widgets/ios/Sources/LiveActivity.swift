import ActivityKit
import Foundation

/// Must match native/widgets/apple/Shared/ActivityModel.swift: the widget extension draws what the app starts.
struct MidoreActivityAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    var title: String
    var kind: String
    var start: Date
    var end: Date
    var color: String
    var nextTitle: String?
    var nextStart: Date?
  }
}

class ActivityArgs: Decodable {
  let activity: ActivityItem?
}

class ActivityItem: Decodable {
  let title: String
  let kind: String
  let start: String
  let end: String
  let color: String
  let nextTitle: String?
  let nextStart: String?
}

enum LiveActivities {
  private static func date(_ s: String?) -> Date? {
    guard let s else { return nil }
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let d = f.date(from: s) { return d }
    f.formatOptions = [.withInternetDateTime]
    return f.date(from: s)
  }

  /// Show `item` (replacing what's shown, or updating it if it's the same thing), or end every Midore activity.
  static func set(_ item: ActivityItem?) async {
    let running = Activity<MidoreActivityAttributes>.activities
    guard let item, let start = date(item.start), let end = date(item.end), end > Date(),
          ActivityAuthorizationInfo().areActivitiesEnabled else {
      for a in running { await a.end(nil, dismissalPolicy: .immediate) }
      return
    }
    let state = MidoreActivityAttributes.ContentState(
      title: item.title, kind: item.kind, start: start, end: end, color: item.color,
      nextTitle: item.nextTitle, nextStart: date(item.nextStart))
    let content = ActivityContent(state: state, staleDate: end)
    if let same = running.first(where: { $0.content.state.start == start && $0.content.state.title == item.title }) {
      await same.update(content)
      for a in running where a.id != same.id { await a.end(nil, dismissalPolicy: .immediate) }
      return
    }
    for a in running { await a.end(nil, dismissalPolicy: .immediate) }
    _ = try? Activity.request(attributes: MidoreActivityAttributes(), content: content)
  }
}
