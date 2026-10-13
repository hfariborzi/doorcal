import Foundation
import SwiftUI

/// One thing on the day: a calendar event (printed, fixed) or planned work (a task block).
struct AgendaItem: Codable, Identifiable, Hashable {
    let kind: String
    let id: String
    let taskId: Int?
    let title: String
    let start: Date
    let end: Date
    let allDay: Bool
    let color: String
    let state: String?

    var isTask: Bool { kind == "task" }
    var tint: Color { Color(hex: color) }
}

struct Agenda: Codable {
    let items: [AgendaItem]
}

struct TaskItem: Codable, Identifiable, Hashable {
    let id: Int
    let title: String
    let dueDate: String?
    let progress: Int
    let color: String
    var tint: Color { Color(hex: color) }
}

struct TaskList: Codable {
    let tasks: [TaskItem]
}

struct Me: Codable {
    let name: String
    let bookingUrl: String
}

extension Color {
    /// "#e11d48" to a Color. The palette comes from the server (src/lib/palette.ts).
    init(hex: String) {
        var v: UInt64 = 0
        Scanner(string: hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))).scanHexInt64(&v)
        self.init(red: Double((v >> 16) & 0xff) / 255, green: Double((v >> 8) & 0xff) / 255, blue: Double(v & 0xff) / 255)
    }

    static let vermilion = Color(hex: "#e11d48")
    static let amber = Color(hex: "#f5a524")
}
