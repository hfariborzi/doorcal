import Foundation

/// The device token and server the Midore app shares with its widgets (see native/plugins/widgets).
/// macOS: a JSON file in the team-prefixed App Group container. iOS: the App Group's UserDefaults.
struct Session: Codable {
    var token: String?
    var baseUrl: String

    #if os(macOS)
    static let appGroup = "9437GLFKZ8.app.midore"
    static func load() -> Session? {
        guard let dir = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup),
              let data = try? Data(contentsOf: dir.appendingPathComponent("session.json")) else { return nil }
        return try? JSONDecoder().decode(Session.self, from: data)
    }
    #else
    static let appGroup = "group.app.midore"
    static func load() -> Session? {
        guard let d = UserDefaults(suiteName: appGroup), let base = d.string(forKey: "baseUrl") else { return nil }
        return Session(token: d.string(forKey: "token"), baseUrl: base)
    }
    #endif
}
