import SwiftRs
import Tauri
import UIKit
import WebKit
import WidgetKit

/// Shares the device token and server address with Midore's widget extension through the App Group, then asks
/// iOS to refresh the widgets. The extension reads the same keys (see native/widgets/apple/Shared/Session.swift).
class SessionArgs: Decodable {
  let token: String?
  let baseUrl: String
}

class WidgetsPlugin: Plugin {
  static let appGroup = "group.app.midore"

  @objc public func setSession(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(SessionArgs.self)
    let defaults = UserDefaults(suiteName: WidgetsPlugin.appGroup)
    if let token = args.token {
      defaults?.set(token, forKey: "token")
    } else {
      defaults?.removeObject(forKey: "token")
    }
    defaults?.set(args.baseUrl, forKey: "baseUrl")
    WidgetCenter.shared.reloadAllTimelines()
    invoke.resolve()
  }
}

@_cdecl("init_plugin_midore_widgets")
public func initPlugin() -> Plugin {
  return WidgetsPlugin()
}
