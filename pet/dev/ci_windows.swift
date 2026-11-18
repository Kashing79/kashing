// 只给 CI 用：列出屏幕上现在有哪些窗口、各自在第几层（从最上面的开始）。
// 用来确认两件事：
//   1. "球球"的画面在系统菜单栏上面（岛才能画在菜单栏那一条上）
//   2. 草地窗口在桌面图标下面、壁纸上面
// 最后几行是结论：OVERLAY_ABOVE_MENU_BAR_OK / LAWN_LEVEL_OK（或者说明哪里不对）。
import Cocoa

let opts: CGWindowListOption = [.optionOnScreenOnly]
var overlayLayer: Int? = nil        // 球球的画面
var lawnLayer: Int? = nil           // 球球的草地
var lawnID = 0
var lawnBounds = ""
var menubarLayer: Int? = nil
var finderIcons: Int? = nil         // 访达画桌面图标的那个窗口
var otherLow: [Int] = []            // 别人的窗口里，在桌面那几层的（壁纸、桌面图标……）
var appWindows = 0                  // 普通那一层（各个 App 的窗口）有几个

if let list = CGWindowListCopyWindowInfo(opts, kCGNullWindowID) as? [[String: Any]] {
    var n = 0
    for w in list {
        let owner = w[kCGWindowOwnerName as String] as? String ?? "?"
        let name = w[kCGWindowName as String] as? String ?? ""
        let layer = w[kCGWindowLayer as String] as? Int ?? -1
        let alpha = w[kCGWindowAlpha as String] as? Double ?? -1
        let number = w[kCGWindowNumber as String] as? Int ?? 0
        let b = w[kCGWindowBounds as String] as? [String: Any] ?? [:]
        func i(_ k: String) -> Int { return Int((b[k] as? NSNumber)?.doubleValue ?? 0) }
        let bounds = "\(i("X")),\(i("Y")),\(i("Width")),\(i("Height"))"
        let mine = owner == "QiuQiu"
        // 前 40 个都列出来；后面的只列我们自己的和桌面那几层的
        if n < 40 || mine || layer < 0 {
            print("WIN layer=\(layer) owner=\(owner) name=\(name) alpha=\(alpha) bounds=\(bounds) id=\(number)")
        }
        n += 1
        if mine {
            if layer > 0 && overlayLayer == nil { overlayLayer = layer }
            if layer < 0 && lawnLayer == nil { lawnLayer = layer; lawnID = number; lawnBounds = bounds }
        } else {
            if name == "Menubar" && menubarLayer == nil { menubarLayer = layer }
            if owner == "Finder" && layer < 0 { finderIcons = max(finderIcons ?? layer, layer) }
            if layer < 0 { otherLow.append(layer) }
            if layer == 0 { appWindows += 1 }
        }
    }
}
let iconLevel = Int(CGWindowLevelForKey(.desktopIconWindow))
let desktopLevel = Int(CGWindowLevelForKey(.desktopWindow))
print("LEVELS mainMenu=\(NSWindow.Level.mainMenu.rawValue) statusBar=\(NSWindow.Level.statusBar.rawValue) popUpMenu=\(NSWindow.Level.popUpMenu.rawValue) screenSaver=\(NSWindow.Level.screenSaver.rawValue) dock=\(CGWindowLevelForKey(.dockWindow)) overlay=\(CGWindowLevelForKey(.overlayWindow)) assistiveTechHigh=\(CGWindowLevelForKey(.assistiveTechHighWindow)) desktopIcon=\(iconLevel) desktop=\(desktopLevel)")

func text(_ v: Int?) -> String {
    if let x = v { return String(x) }
    return "none"
}
// 桌面图标在第几层（没找到访达的那个窗口就用系统说的数）；壁纸 = 它下面最底下的那一层
let icons = finderIcons ?? iconLevel
let below = otherLow.filter { $0 < icons }
let wallpaper = below.min() ?? (desktopLevel - 1)
print("SUMMARY overlay=\(text(overlayLayer)) menubar=\(text(menubarLayer)) lawn=\(text(lawnLayer)) lawnId=\(lawnID) lawnBounds=\(lawnBounds) icons=\(icons) wallpaper=\(wallpaper) appWindows=\(appWindows)")

// 1. 画面要比菜单栏高
let bar = menubarLayer ?? NSWindow.Level.mainMenu.rawValue
if let o = overlayLayer, o > bar {
    print("OVERLAY_ABOVE_MENU_BAR_OK")
} else {
    print("OVERLAY_NOT_ABOVE_MENU_BAR")
}

// 2. 草地要在桌面图标下面、壁纸上面
if let l = lawnLayer {
    if l < icons && l >= desktopLevel && l > wallpaper {
        print("LAWN_LEVEL_OK")
    } else {
        print("LAWN_LEVEL_WRONG lawn=\(l) must be below \(icons), not below \(desktopLevel), and above \(wallpaper)")
    }
} else {
    print("LAWN_NOT_FOUND")
}
