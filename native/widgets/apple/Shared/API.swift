import Foundation

/// Calls /api/v1 with the shared device token. Widgets fetch on their own so they stay fresh without the app.
enum MidoreAPI {
    enum Failure: Error { case signedOut, offline }

    private static let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .custom { dec in
            let s = try dec.singleValueContainer().decode(String.self)
            let iso = ISO8601DateFormatter()
            iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = iso.date(from: s) { return date }
            iso.formatOptions = [.withInternetDateTime]
            if let date = iso.date(from: s) { return date }
            iso.formatOptions = [.withFullDate]
            if let date = iso.date(from: s) { return date }
            throw DecodingError.dataCorrupted(.init(codingPath: dec.codingPath, debugDescription: "date \(s)"))
        }
        return d
    }()

    private static func request(_ path: String, method: String = "GET", body: [String: Any]? = nil) async throws -> Data {
        guard let session = Session.load(), let token = session.token, let url = URL(string: session.baseUrl + path) else { throw Failure.signedOut }
        var req = URLRequest(url: url, timeoutInterval: 20)
        req.httpMethod = method
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        let (data, response) = try await URLSession.shared.data(for: req)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        if status == 401 { throw Failure.signedOut }
        guard (200..<300).contains(status) else { throw Failure.offline }
        return data
    }

    static func agenda(days: Int = 1) async throws -> [AgendaItem] {
        try decoder.decode(Agenda.self, from: try await request("/api/v1/agenda?days=\(days)")).items
    }

    static func tasks() async throws -> [TaskItem] {
        try decoder.decode(TaskList.self, from: try await request("/api/v1/tasks")).tasks
    }

    static func me() async throws -> Me {
        try decoder.decode(Me.self, from: try await request("/api/v1/me"))
    }

    /// Quick add (the share extension). Midore plans it into the week.
    static func addTask(title: String) async throws {
        _ = try await request("/api/v1/tasks", method: "POST", body: ["title": title])
    }

    static func setStatus(task: Int, status: String) async throws {
        _ = try await request("/api/v1/tasks/\(task)/status", method: "POST", body: ["status": status])
    }

    static func markBlock(task: Int, start: Date, end: Date, status: String) async throws {
        let iso = ISO8601DateFormatter()
        _ = try await request("/api/v1/blocks/mark", method: "POST", body: ["taskId": task, "start": iso.string(from: start), "end": iso.string(from: end), "state": ["status": status]])
    }
}
