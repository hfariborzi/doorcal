#if os(iOS)
import ActivityKit
import Foundation

/// What's on now, shown as a Live Activity on the Lock Screen and in the Dynamic Island. The app starts it (see
/// plugins/widgets/ios, which declares the same type); the widget extension draws it (LiveActivity.swift).
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
#endif
