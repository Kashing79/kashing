// 只给 CI 用：列出屏幕上现在有哪些窗口、各自在第几层（从最上面的开始）。
// 用来确认"球球"的窗口和系统菜单栏谁在上面。
import Cocoa

let opts: CGWindowListOption = [.optionOnScreenOnly]
if let list = CGWindowListCopyWindowInfo(opts, kCGNullWindowID) as? [[String: Any]] {
    var n = 0
    for w in list {
        let owner = w[kCGWindowOwnerName as String] as? String ?? "?"
        let name = w[kCGWindowName as String] as? String ?? ""
        let layer = w[kCGWindowLayer as String] as? Int ?? -1
        let alpha = w[kCGWindowAlpha as String] as? Double ?? -1
        let b = w[kCGWindowBounds as String] as? [String: Any] ?? [:]
        func i(_ k: String) -> Int { return Int((b[k] as? NSNumber)?.doubleValue ?? 0) }
        print("WIN layer=\(layer) owner=\(owner) name=\(name) alpha=\(alpha) bounds=\(i("X")),\(i("Y")),\(i("Width")),\(i("Height"))")
        n += 1
        if n >= 40 { break }
    }
}
print("LEVELS mainMenu=\(NSWindow.Level.mainMenu.rawValue) statusBar=\(NSWindow.Level.statusBar.rawValue) popUpMenu=\(NSWindow.Level.popUpMenu.rawValue) screenSaver=\(NSWindow.Level.screenSaver.rawValue) dock=\(CGWindowLevelForKey(.dockWindow)) overlay=\(CGWindowLevelForKey(.overlayWindow)) assistiveTechHigh=\(CGWindowLevelForKey(.assistiveTechHighWindow))")
