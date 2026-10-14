import SwiftUI
import UIKit
import UniformTypeIdentifiers

/// Share to Midore: text or a link shared from any app becomes a task, which Midore plans into the week.
/// It uses the device token the app shares through the App Group (Shared/Session.swift).
@objc(ShareViewController)
final class ShareViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        let model = ShareModel(context: extensionContext)
        let host = UIHostingController(rootView: ShareView(model: model))
        addChild(host)
        host.view.frame = view.bounds
        host.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(host.view)
        host.didMove(toParent: self)
        Task { await model.load() }
    }
}

@MainActor
final class ShareModel: ObservableObject {
    enum Phase: Equatable { case editing, saving, saved, signedOut, failed(String) }

    @Published var title = ""
    @Published var phase: Phase = .editing
    private weak var context: NSExtensionContext?

    init(context: NSExtensionContext?) {
        self.context = context
    }

    /// The shared text and link, as one task title ("Read this article https://…").
    func load() async {
        if Session.load()?.token == nil {
            phase = .signedOut
            return
        }
        var text: String?
        var link: String?
        for item in context?.inputItems as? [NSExtensionItem] ?? [] {
            if let t = item.attributedContentText?.string, !t.isEmpty { text = text ?? t }
            for provider in item.attachments ?? [] {
                if link == nil, provider.hasItemConformingToTypeIdentifier(UTType.url.identifier),
                   let url = try? await provider.loadItem(forTypeIdentifier: UTType.url.identifier) as? URL {
                    link = url.isFileURL ? nil : url.absoluteString
                } else if text == nil, provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier),
                          let t = try? await provider.loadItem(forTypeIdentifier: UTType.plainText.identifier) as? String {
                    text = t
                }
            }
        }
        let parts = [text?.trimmingCharacters(in: .whitespacesAndNewlines), link].compactMap { $0 }.filter { !$0.isEmpty }
        title = String(parts.joined(separator: " ").prefix(300))
    }

    func save() async {
        let t = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty else { return }
        phase = .saving
        do {
            try await MidoreAPI.addTask(title: String(t.prefix(300)))
            phase = .saved
            try? await Task.sleep(for: .milliseconds(900))
            context?.completeRequest(returningItems: nil)
        } catch MidoreAPI.Failure.signedOut {
            phase = .signedOut
        } catch {
            phase = .failed("Couldn't reach Midore. Try again in a moment.")
        }
    }

    func cancel() {
        context?.cancelRequest(withError: NSError(domain: "app.midore.share", code: 0))
    }
}

struct ShareView: View {
    @ObservedObject var model: ShareModel
    @FocusState private var focused: Bool

    var body: some View {
        NavigationStack {
            Form {
                switch model.phase {
                case .signedOut:
                    Section {
                        Text("Open Midore and sign in first. Then you can share anything to it as a task.")
                            .foregroundStyle(.secondary)
                    }
                case .saved:
                    Section {
                        Label("Added. Midore will fit it into your week.", systemImage: "checkmark.circle.fill")
                            .foregroundStyle(Color(hex: "#e11d48"))
                    }
                default:
                    Section {
                        TextField("What to do", text: $model.title, axis: .vertical)
                            .lineLimit(2...6)
                            .focused($focused)
                    } footer: {
                        if case .failed(let message) = model.phase {
                            Text(message).foregroundStyle(.red)
                        } else {
                            Text("Midore will fit it into your week.")
                        }
                    }
                }
            }
            .navigationTitle("Add to Midore")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { model.cancel() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    if model.phase == .saving {
                        ProgressView()
                    } else if model.phase != .signedOut && model.phase != .saved {
                        Button("Add") { Task { await model.save() } }
                            .disabled(model.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                }
            }
            .onAppear { focused = true }
        }
        .tint(Color(hex: "#e11d48"))
    }
}
