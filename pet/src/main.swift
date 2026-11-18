// 球球 · Mac 外壳
//
// 做的事情很少：开一个透明、没有边框、永远在最上层的窗口，贴在屏幕最下面，
// 里面用系统自带的 WebKit 显示 web/ 文件夹里的像素小人和小狗。
// 平时鼠标可以直接穿过这个窗口；只有移到小人、小狗、小球身上时才会被接住。
//
// 不联网，不需要任何系统权限（不读屏幕、不读键盘）。

import Cocoa
import WebKit

// MARK: - 文字（跟着系统语言走：繁体 / 简体 / 英文）

enum L10n {
    enum Lang { case hant, hans, en }

    static let lang: Lang = {
        let pref = (Locale.preferredLanguages.first ?? "en").lowercased()
        if pref.hasPrefix("zh") {
            if pref.contains("hant") || pref.contains("-tw") || pref.contains("-hk") || pref.contains("-mo") {
                return .hant
            }
            return .hans
        }
        return .en
    }()

    static func t(_ hant: String, _ hans: String, _ en: String) -> String {
        switch lang {
        case .hant: return hant
        case .hans: return hans
        case .en: return en
        }
    }
}

let kBundleID = "local.qiuqiu.deskpet"

// MARK: - 窗口

/// 永远不抢键盘焦点的面板：点它不会让正在打字的 App 失去焦点。
final class PetPanel: NSPanel {
    var debugLog = false
    override var canBecomeKey: Bool { return false }
    override var canBecomeMain: Bool { return false }
    override func sendEvent(_ event: NSEvent) {
        if debugLog && (event.type == .leftMouseDown || event.type == .leftMouseUp) {
            print("PANEL event \(event.type == .leftMouseDown ? "down" : "up") appActive=\(NSApp.isActive) ignores=\(ignoresMouseEvents)")
            fflush(stdout)
        }
        super.sendEvent(event)
    }
}

/// 网页只负责画画，鼠标事件全部交给盖在上面的 InputView。
final class PetWebView: WKWebView {
    override func hitTest(_ point: NSPoint) -> NSView? { return nil }
}

/// 盖在最上面的一层透明 View，把鼠标按下 / 拖动 / 松开转告给网页。
final class InputView: NSView {
    weak var owner: AppDelegate?

    override var isOpaque: Bool { return false }
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { return true }
    override func mouseDown(with event: NSEvent) { owner?.forwardMouse("down", event) }
    override func mouseDragged(with event: NSEvent) { owner?.forwardMouse("move", event) }
    override func mouseUp(with event: NSEvent) { owner?.forwardMouse("up", event) }
    override func rightMouseDown(with event: NSEvent) { owner?.popUpMenu(with: event) }
}

// MARK: - App

final class AppDelegate: NSObject, NSApplicationDelegate, WKScriptMessageHandler, WKNavigationDelegate, NSMenuDelegate {

    private var panel: PetPanel!
    private var web: PetWebView!
    private var input: InputView!
    private var statusItem: NSStatusItem!
    private var menu: NSMenu!
    private var timer: Timer?

    /// 网页告诉我们的"可以点的区域"（页面坐标，原点在左上角，单位是 pt）
    private var hot: [CGRect] = []
    private var jsDragging = false
    private var mouseDownInside = false
    private var interactive = false
    private var hoverInside = false
    private var lastHover = CGPoint(x: -1, y: -1)
    private var hiddenByUser = false
    private var stuckTicks = 0
    private var tickCount = 0

    private let defaults = UserDefaults.standard
    private let selfTestPath: String?
    private let debug: Bool

    override init() {
        let args = CommandLine.arguments
        if let i = args.firstIndex(of: "--selftest"), i + 1 < args.count {
            selfTestPath = args[i + 1]
        } else {
            selfTestPath = nil
        }
        debug = args.contains("--debug")
        super.init()
    }

    // MARK: 启动

    func applicationDidFinishLaunching(_ notification: Notification) {
        defaults.register(defaults: ["scale": 3, "auto": true, "screen": 0])
        buildWindow()
        buildMenu()
        loadPage()

        NotificationCenter.default.addObserver(
            self, selector: #selector(screensChanged),
            name: NSApplication.didChangeScreenParametersNotification, object: nil)

        let t = Timer(timeInterval: 1.0 / 30.0, target: self, selector: #selector(tick), userInfo: nil, repeats: true)
        t.tolerance = 0.005
        RunLoop.main.add(t, forMode: .common)
        timer = t

        if debug {
            panel.debugLog = true
            // 调试：别的 App 收到的鼠标按下（说明这次点击没有落在我们的窗口上）
            NSEvent.addGlobalMonitorForEvents(matching: [.leftMouseDown]) { [weak self] _ in
                print("GLOBAL down (went to another app) interactive=\(self?.interactive ?? false) ignores=\(self?.panel.ignoresMouseEvents ?? true)")
                fflush(stdout)
            }
            let f = panel.frame
            let sh = NSScreen.screens.first?.frame.height ?? 0
            print("FRAME \(Int(f.minX)) \(Int(sh - f.maxY)) \(Int(f.width)) \(Int(f.height))")
            fflush(stdout)
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { return false }

    // MARK: 窗口放在哪

    private func targetScreen() -> NSScreen? {
        let screens = NSScreen.screens
        if screens.isEmpty { return nil }
        let i = defaults.integer(forKey: "screen")
        return screens[min(max(i, 0), screens.count - 1)]
    }

    /// 屏幕可用区域（不含 Dock 和菜单栏）最下面的一条。
    private func targetFrame() -> CGRect? {
        guard let screen = targetScreen() else { return nil }
        let vf = screen.visibleFrame
        let h = min(vf.height, min(380, max(240, vf.height * 0.42)))
        return CGRect(x: vf.minX, y: vf.minY, width: vf.width, height: h)
    }

    private func layoutWindow() {
        guard let f = targetFrame() else { return }
        if panel.frame != f { panel.setFrame(f, display: true) }
    }

    @objc private func screensChanged() { layoutWindow() }

    private func buildWindow() {
        let f = targetFrame() ?? CGRect(x: 0, y: 0, width: 900, height: 300)
        panel = PetPanel(contentRect: f, styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        panel.isOpaque = false
        panel.backgroundColor = NSColor.clear
        panel.hasShadow = false
        panel.level = .floating
        panel.isFloatingPanel = true
        panel.hidesOnDeactivate = false
        panel.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]
        panel.ignoresMouseEvents = true
        panel.isReleasedWhenClosed = false
        panel.isMovable = false
        panel.isExcludedFromWindowsMenu = true
        panel.animationBehavior = .none
        panel.title = "QiuQiu"

        let content = NSView(frame: CGRect(origin: .zero, size: f.size))
        content.autoresizingMask = [.width, .height]

        let conf = WKWebViewConfiguration()
        conf.userContentController.add(self, name: "pet")
        // 让网页背景透明。这是 WebKit 的非公开开关，所以先确认它存在再用，免得哪天没有了会闪退。
        if conf.responds(to: Selector(("_setDrawsBackground:"))) {
            conf.setValue(false, forKey: "drawsBackground")
        }

        web = PetWebView(frame: content.bounds, configuration: conf)
        web.autoresizingMask = [.width, .height]
        if web.responds(to: Selector(("_setDrawsBackground:"))) {
            web.setValue(false, forKey: "drawsBackground")
        }
        if #available(macOS 12.0, *) {
            web.underPageBackgroundColor = NSColor.clear
        }
        web.navigationDelegate = self
        content.addSubview(web)

        input = InputView(frame: content.bounds)
        input.autoresizingMask = [.width, .height]
        input.owner = self
        content.addSubview(input)

        panel.contentView = content
        panel.orderFrontRegardless()
    }

    private func loadPage() {
        var dir: URL?
        if let override = ProcessInfo.processInfo.environment["QIUQIU_WEB"], !override.isEmpty {
            dir = URL(fileURLWithPath: override, isDirectory: true)
        } else {
            dir = Bundle.main.resourceURL?.appendingPathComponent("web", isDirectory: true)
        }
        guard let webDir = dir else { return }
        let index = webDir.appendingPathComponent("index.html")
        if !FileManager.default.fileExists(atPath: index.path) {
            print("找不到页面：\(index.path)")
            if selfTestPath != nil { print("SELFTEST FAIL missing index.html"); exit(1) }
            return
        }
        web.loadFileURL(index, allowingReadAccessTo: webDir)
    }

    // MARK: 和网页说话

    private func js(_ code: String) {
        web.evaluateJavaScript(code, completionHandler: nil)
    }

    private func pushConfig() {
        let scale = defaults.integer(forKey: "scale")
        let auto = defaults.bool(forKey: "auto")
        js("window.pet&&window.pet.configure({scale:\(scale),auto:\(auto ? "true" : "false"),paused:\(hiddenByUser ? "true" : "false")});")
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        pushConfig()
        if let path = selfTestPath {
            perform(#selector(runSelfTest(_:)), with: path, afterDelay: 3.0)
        }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let text = message.body as? String,
              let data = text.data(using: .utf8),
              let parsed = try? JSONSerialization.jsonObject(with: data, options: []),
              let obj = parsed as? [String: Any],
              let type = obj["t"] as? String else { return }
        if type == "hot" {
            var rects: [CGRect] = []
            if let r = obj["r"] as? [Any] {
                var i = 0
                while i + 3 < r.count {
                    let x = (r[i] as? NSNumber)?.doubleValue ?? 0
                    let y = (r[i + 1] as? NSNumber)?.doubleValue ?? 0
                    let w = (r[i + 2] as? NSNumber)?.doubleValue ?? 0
                    let h = (r[i + 3] as? NSNumber)?.doubleValue ?? 0
                    rects.append(CGRect(x: x, y: y, width: w, height: h))
                    i += 4
                }
            }
            hot = rects
            let dragging = ((obj["d"] as? NSNumber)?.intValue ?? 0) != 0
            if debug && dragging != jsDragging { print("JSDRAG \(dragging ? 1 : 0)"); fflush(stdout) }
            jsDragging = dragging
        } else if type == "ready" {
            pushConfig()
        }
    }

    // MARK: 鼠标

    /// 每秒 30 次：看看鼠标在不在小人 / 小狗 / 小球身上，决定窗口要不要"接住"鼠标。
    @objc private func tick() {
        tickCount += 1
        if tickCount % 60 == 0 { layoutWindow() }   // Dock 变大变小、换了分辨率之类
        if hiddenByUser { return }

        let m = NSEvent.mouseLocation
        let f = panel.frame
        let local = CGPoint(x: m.x - f.minX, y: f.maxY - m.y)
        let inside = local.x >= -30 && local.x <= f.width + 30 && local.y >= -30 && local.y <= f.height + 4

        var over = false
        if inside {
            for r in hot where r.contains(local) { over = true; break }
        }
        let buttons = NSEvent.pressedMouseButtons

        // 保险：鼠标早就松开了，但我们还以为在拖 → 强制结束
        if (mouseDownInside || jsDragging) && buttons == 0 {
            stuckTicks += 1
            if stuckTicks > 12 {
                stuckTicks = 0
                mouseDownInside = false
                jsDragging = false
                js("window.pet&&window.pet.pointer('up',0,0)")
            }
        } else {
            stuckTicks = 0
        }

        var want = false
        if mouseDownInside || jsDragging {
            want = true
        } else if over {
            // 如果她正按着鼠标在拖别的东西经过这里，不要去抢
            want = interactive || buttons == 0
        }
        if want != interactive {
            interactive = want
            panel.ignoresMouseEvents = !want
            if debug { print("INTERACTIVE \(want ? 1 : 0)"); fflush(stdout) }
        }
        if debug && tickCount % 5 == 0 { debugHot() }

        if !mouseDownInside {
            if inside {
                if !hoverInside || abs(local.x - lastHover.x) > 0.5 || abs(local.y - lastHover.y) > 0.5 {
                    hoverInside = true
                    lastHover = local
                    js("window.pet&&window.pet.pointer('hover',\(Int(local.x)),\(Int(local.y)))")
                }
            } else if hoverInside {
                hoverInside = false
                js("window.pet&&window.pet.pointer('leave',0,0)")
            }
        }
    }

    fileprivate func forwardMouse(_ type: String, _ event: NSEvent) {
        let p = event.locationInWindow
        let h = panel.contentView?.bounds.height ?? panel.frame.height
        let x = Int(p.x.rounded())
        let y = Int((h - p.y).rounded())
        if type == "down" { mouseDownInside = true }
        if type == "up" { mouseDownInside = false }
        if debug && type != "move" { print("MOUSE \(type) \(x) \(y)"); fflush(stdout) }
        js("window.pet&&window.pet.pointer('\(type)',\(x),\(y))")
    }

    /// 调试用：把可点区域换算成整块屏幕的坐标（原点在主屏左上角）打印出来。第一个通常是小球。
    private func debugHot() {
        let f = panel.frame
        let sh = NSScreen.screens.first?.frame.height ?? 0
        var parts: [String] = []
        for r in hot {
            let gx = f.minX + r.minX
            let gy = (sh - f.maxY) + r.minY
            parts.append("\(Int(gx)),\(Int(gy)),\(Int(r.width)),\(Int(r.height))")
        }
        print("HOT \(parts.joined(separator: " "))")
        fflush(stdout)
    }

    // MARK: 菜单

    private func buildMenu() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        statusItem.button?.title = "🎾"
        statusItem.button?.toolTip = L10n.t("球球", "球球", "QiuQiu")
        menu = NSMenu()
        menu.delegate = self
        statusItem.menu = menu
        rebuildMenu()
    }

    func menuNeedsUpdate(_ menu: NSMenu) { rebuildMenu() }

    @discardableResult
    private func addItem(_ title: String, _ action: Selector, to m: NSMenu) -> NSMenuItem {
        let item = NSMenuItem(title: title, action: action, keyEquivalent: "")
        item.target = self
        m.addItem(item)
        return item
    }

    private func rebuildMenu() {
        menu.removeAllItems()
        addItem(L10n.t("丟球球！", "丢球球！", "Throw the ball!"), #selector(throwBall), to: menu)
        addItem(L10n.t("打個招呼", "打个招呼", "Say hi"), #selector(sayHi), to: menu)
        menu.addItem(NSMenuItem.separator())

        let auto = addItem(L10n.t("小人自動丟球", "小人自动丢球", "Auto-play"), #selector(toggleAuto), to: menu)
        auto.state = defaults.bool(forKey: "auto") ? .on : .off

        let sizeItem = NSMenuItem(title: L10n.t("大小", "大小", "Size"), action: nil, keyEquivalent: "")
        let sizeMenu = NSMenu()
        let current = defaults.integer(forKey: "scale")
        let sizes: [(String, Int)] = [
            (L10n.t("小", "小", "Small"), 2),
            (L10n.t("中", "中", "Medium"), 3),
            (L10n.t("大", "大", "Large"), 4),
        ]
        for entry in sizes {
            let item = addItem(entry.0, #selector(setSize(_:)), to: sizeMenu)
            item.tag = entry.1
            item.state = (current == entry.1) ? .on : .off
        }
        sizeItem.submenu = sizeMenu
        menu.addItem(sizeItem)

        if NSScreen.screens.count > 1 {
            addItem(L10n.t("換到另一個螢幕", "换到另一个屏幕", "Move to next display"), #selector(nextScreen), to: menu)
        }

        let login = addItem(L10n.t("開機自動啟動", "开机自动启动", "Launch at login"), #selector(toggleLogin), to: menu)
        login.state = loginEnabled() ? .on : .off

        menu.addItem(NSMenuItem.separator())
        addItem(hiddenByUser ? L10n.t("出來玩", "出来玩", "Show") : L10n.t("先躲起來", "先躲起来", "Hide"),
                #selector(toggleHidden), to: menu)
        addItem(L10n.t("結束", "退出", "Quit"), #selector(quit), to: menu)
    }

    fileprivate func popUpMenu(with event: NSEvent) {
        rebuildMenu()
        NSMenu.popUpContextMenu(menu, with: event, for: input)
    }

    @objc private func throwBall() {
        if hiddenByUser { toggleHidden() }
        js("window.pet&&window.pet.command('throw')")
    }

    @objc private func sayHi() {
        if hiddenByUser { toggleHidden() }
        js("window.pet&&window.pet.command('wave')")
    }

    @objc private func toggleAuto() {
        defaults.set(!defaults.bool(forKey: "auto"), forKey: "auto")
        pushConfig()
    }

    @objc private func setSize(_ sender: NSMenuItem) {
        defaults.set(sender.tag, forKey: "scale")
        pushConfig()
    }

    @objc private func nextScreen() {
        let n = NSScreen.screens.count
        if n == 0 { return }
        defaults.set((defaults.integer(forKey: "screen") + 1) % n, forKey: "screen")
        layoutWindow()
    }

    @objc private func toggleHidden() {
        hiddenByUser = !hiddenByUser
        if hiddenByUser {
            interactive = false
            panel.ignoresMouseEvents = true
            panel.orderOut(nil)
        } else {
            layoutWindow()
            panel.orderFrontRegardless()
        }
        pushConfig()
    }

    @objc private func quit() { NSApp.terminate(nil) }

    // MARK: 开机自动启动（在 ~/Library/LaunchAgents 放一个小文件，关掉就是把它删了）

    private var agentURL: URL {
        return FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/LaunchAgents/\(kBundleID).plist")
    }

    private func loginEnabled() -> Bool {
        return FileManager.default.fileExists(atPath: agentURL.path)
    }

    @objc private func toggleLogin() {
        let fm = FileManager.default
        if loginEnabled() {
            try? fm.removeItem(at: agentURL)
            return
        }
        guard let exe = Bundle.main.executablePath else { return }
        let plist: [String: Any] = [
            "Label": kBundleID,
            "ProgramArguments": [exe],
            "RunAtLoad": true,
            "ProcessType": "Interactive",
            "LimitLoadToSessionType": "Aqua",
        ]
        try? fm.createDirectory(at: agentURL.deletingLastPathComponent(), withIntermediateDirectories: true, attributes: nil)
        if let data = try? PropertyListSerialization.data(fromPropertyList: plist, format: .xml, options: 0) {
            try? data.write(to: agentURL)
        }
    }

    // MARK: 自检（安装完可以跑： QiuQiu --selftest /tmp/qiuqiu.png ）
    // 给页面拍一张照存成 PNG，并检查：页面有没有画出东西、背景是不是透明的。

    @objc private func runSelfTest(_ path: String) {
        web.evaluateJavaScript("JSON.stringify(window.pet&&window.pet._t?window.pet._t.state():null)") { result, _ in
            print("SELFTEST state \(result as? String ?? "nil")")
        }
        print("SELFTEST hotRects \(hot.count) panel \(Int(panel.frame.width))x\(Int(panel.frame.height)) visible \(panel.isVisible)")
        web.takeSnapshot(with: nil) { image, error in
            guard let image = image,
                  let tiff = image.tiffRepresentation,
                  let rep = NSBitmapImageRep(data: tiff) else {
                print("SELFTEST FAIL snapshot: \(String(describing: error))")
                fflush(stdout)
                exit(1)
            }
            if let png = rep.representation(using: .png, properties: [:]) {
                try? png.write(to: URL(fileURLWithPath: path))
            }
            let w = rep.pixelsWide, h = rep.pixelsHigh
            var drawn = 0, clear = 0, total = 0
            var y = 0
            while y < h {
                var x = 0
                while x < w {
                    let a = rep.colorAt(x: x, y: y)?.alphaComponent ?? 0
                    total += 1
                    if a > 0.5 { drawn += 1 } else if a < 0.02 { clear += 1 }
                    x += 3
                }
                y += 3
            }
            let topLeft = rep.colorAt(x: 2, y: 2)?.alphaComponent ?? 1
            let topRight = rep.colorAt(x: max(0, w - 3), y: 2)?.alphaComponent ?? 1
            print("SELFTEST snapshot \(w)x\(h) drawn=\(drawn) clear=\(clear) total=\(total) cornerAlpha=\(topLeft),\(topRight)")
            let transparent = topLeft < 0.02 && topRight < 0.02 && clear > total / 2
            let hasPets = drawn > 50
            if transparent && hasPets {
                print("SELFTEST PASS")
            } else {
                print("SELFTEST FAIL transparent=\(transparent) hasPets=\(hasPets)")
            }
            fflush(stdout)
            exit(transparent && hasPets ? 0 : 1)
        }
    }
}

// MARK: - main

let selfTesting = CommandLine.arguments.contains("--selftest")

// 已经有一个在跑了就不要再开第二个
if !selfTesting {
    let mine = ProcessInfo.processInfo.processIdentifier
    let others = NSRunningApplication.runningApplications(withBundleIdentifier: kBundleID)
        .filter { $0.processIdentifier != mine }
    if !others.isEmpty { exit(0) }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.accessory)
app.run()
