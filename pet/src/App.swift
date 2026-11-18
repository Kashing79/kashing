// 球球 · App 本身：启动、几个设定、屏幕有多大、窗口放在哪
//
// 别的文件给这个类添了各自那一摊事（节奏 Loop.swift、鼠标 Input.swift、菜单 Menu.swift、
// 外面的事 Sense.swift、自检 SelfTest.swift），要记的东西都集中写在这里。

import Cocoa
import QuartzCore

/// 打印一行，马上送出去（调试和自检的输出，测试脚本要读）
func say(_ s: String) {
    print(s)
    fflush(stdout)
}

/// 屏幕现在的样子（单位 pt）
struct ScreenGeometry: Equatable {
    var frame = CGRect(x: 0, y: 0, width: 900, height: 300)
    var top: CGFloat = 24           // 菜单栏占了多少
    var bottom: CGFloat = 0         // 程序坞占了多少
    var left: CGFloat = 0
    var right: CGFloat = 0
    var barH: CGFloat = 24          // 岛合着的时候多高
    var notchW: CGFloat = 0         // 刘海多宽（没有就是 0）
    var notchMid: CGFloat = 450     // 岛的中心离屏幕左边多远
    var backing: CGFloat = 2        // 一 pt 是几个屏幕像素
}

final class AppDelegate: NSObject, NSApplicationDelegate {

    // —— 启动时就定了的 ——
    let defaults = UserDefaults.standard
    let selfTestPath: String?
    let debug: Bool

    // —— 窗口和画面 ——
    var panel: PetPanel!
    var stageView: StageView!
    let sprites = SpriteLayers()
    let bubble = BubbleLayer()
    let island = Island()
    let lawn = Lawn()
    var engine: PetEngine?
    var statusItem: NSStatusItem!
    var menu: NSMenu!

    // —— 版面 ——
    var geo = ScreenGeometry()
    var unit: CGFloat = 3           // 一个世界单位是几 pt
    var res = 2                     // 一个世界单位画成几个像素
    var offTop: CGFloat = 0         // 世界的 y = 0 在屏幕顶边下面多少 pt
    var viewW = 300.0               // 画面有多大（世界单位）
    var viewH = 100.0

    // —— 鼠标 ——
    var petHot: [CGRect] = []       // 球和角色身上可以点的范围（面板里的 pt，从上往下算）
    var jsDragging = false          // 引擎说：她正拖着球 / 拎着谁
    var mouseDownInside = false
    var islandOwnsMouse = false     // 这一下是按在岛上的
    var interactive = false         // 窗口现在接不接鼠标
    var hoverNear = false
    var lastHover = CGPoint(x: -1, y: -1)
    var hoverTicks = 0
    var stuckTicks = 0
    var tickCount = 0

    // —— 节奏 ——
    var timer: Timer?
    var displayLink: AnyObject?
    var linkOn = false
    var linkBroken = false
    var linkMisses = 0
    var lastFrameAt: CFTimeInterval = 0
    var forceFrame = false
    var busy = 2
    var home = "out"
    var status = EngineStatus()
    var statusAt: CFTimeInterval = 0
    var lastItemCount = 0

    // —— 该不该动 ——
    var running = false
    var hiddenByUser = false
    var screensOff = false
    var machineAsleep = false
    var sessionOff = false
    var screenLocked = false
    var occluded = false
    var toldAsleep = false

    // —— 画一帧有多吃力 ——
    var jitMs = 0.0
    var jitFast = true
    var quality = 1.0
    var perfWarmup = 8
    var perfSum = 0.0
    var perfN = 0
    var perfFirstDone = false
    var perfBusyAvg = 0.0
    var perfAllSum = 0.0
    var perfAllN = 0

    // —— 草地 ——
    var lawnPhase = "day"
    var lawnPhaseSince: CFTimeInterval = 0

    // —— 外面的事 ——
    var cursor = CGPoint.zero
    var cursorOn = false
    var cursorSent = CGPoint(x: -9999, y: -9999)
    var cursorTold = false
    var cursorSentAt: CFTimeInterval = 0
    var idleSentAt: CFTimeInterval = 0
    var idleTold = 0.0
    var batteryAt: CFTimeInterval = 0
    var batteryTold = ""
    var placesAt: CFTimeInterval = 0
    var placesTold = ""

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
        defaults.register(defaults: ["scale": 3, "auto": true, "screen": 0, "roam": true, "island": true,
                                     "lawn": "full", "frontApp": false])
        geo = readGeometry()
        buildWindow()
        startEngine()
        island.setEnabled(defaults.bool(forKey: "island"))
        lawnPhase = currentPhase()
        applyGeometry(force: true)
        buildMenu()
        startSensing()
        NotificationCenter.default.addObserver(
            self, selector: #selector(screensChanged),
            name: NSApplication.didChangeScreenParametersNotification, object: nil)

        if debug {
            // 调试：别的 App 收到的鼠标按下（说明这次点击没有落在我们的窗口上）
            NSEvent.addGlobalMonitorForEvents(matching: [.leftMouseDown]) { [weak self] _ in
                say("GLOBAL down (went to another app) interactive=\(self?.interactive ?? false) ignores=\(self?.panel.ignoresMouseEvents ?? true)")
            }
            let f = panel.frame
            let sh = NSScreen.screens.first?.frame.height ?? 0
            say("FRAME \(Int(f.minX)) \(Int(sh - f.maxY)) \(Int(f.width)) \(Int(f.height))")
        }
        updateActivity()
        if let path = selfTestPath {
            perform(#selector(runSelfTest(_:)), with: path, afterDelay: 3.0)
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { return false }

    /// 把玩法（web/ 里的 JavaScript）读进来，建好引擎
    private func startEngine() {
        var dir: URL? = nil
        if let override = ProcessInfo.processInfo.environment["QIUQIU_WEB"], !override.isEmpty {
            dir = URL(fileURLWithPath: override, isDirectory: true)
        } else {
            dir = Bundle.main.resourceURL?.appendingPathComponent("web", isDirectory: true)
        }
        guard let webDir = dir, let eng = PetEngine() else {
            engineFailed("JavaScriptCore did not start")
            return
        }
        eng.verbose = debug || selfTestPath != nil
        eng.islandCenter = { [weak self] in
            guard let s = self, s.unit > 0 else { return 0 }
            return Double(s.island.midX / s.unit)
        }
        eng.islandVisible = { [weak self] in
            guard let s = self else { return false }
            return s.island.enabled
        }
        eng.islandHit = { [weak self] x, y in
            guard let s = self else { return false }
            return s.island.dropHit(s.toPanel(x, y))
        }
        eng.islandRim = { [weak self] in
            guard let s = self, s.unit > 0, s.island.rect != nil else { return "" }
            let a = s.toWorld(CGPoint(x: s.island.midX - s.island.bodyW / 2, y: s.island.bodyH))
            let b = s.toWorld(CGPoint(x: s.island.midX + s.island.bodyW / 2, y: s.island.bodyH))
            return "\(a.x),\(b.x),\(a.y)"
        }
        eng.islandPulse = { [weak self] kind in
            self?.island.pulse(kind)
        }
        eng.load(from: webDir)
        if !eng.hasEngineScript {
            engineFailed("PET_ENGINE not found in \(webDir.path) (loaded: \(eng.loaded.joined(separator: " ")))")
            return
        }
        // 这台机器上 JavaScript 跑得快不快：慢的话角色少重画几次
        // 量两次取快的那次：刚启动时机器可能正忙（第一次也包含了"即时编译"热身的时间）
        jitMs = min(eng.speedProbe(), eng.speedProbe())
        jitFast = jitMs < 60

        let pick = AppDelegate.pickScale(choice: defaults.integer(forKey: "scale"), backing: geo.backing, baseRes: eng.baseRes)
        unit = pick.unit
        res = pick.res
        var options: [String: Any] = [
            "res": res,
            "roam": defaults.bool(forKey: "roam"),
            "auto": defaults.bool(forKey: "auto"),
            "grass": grassOn(eng),
            "lawnTap": false,
        ]
        if selfTestPath != nil { options["nightSleep"] = NSNull() }      // 自检不管现在几点，都要它们出来
        if !eng.create(options: options) {
            engineFailed("PET_ENGINE.create failed: \(eng.lastException)")
            return
        }
        engine = eng
        if !jitFast {
            quality = 0.5
            eng.setQuality(quality)
        }
        // 这两个开关她动过才告诉引擎；没动过就听 config.js 的
        if defaults.object(forKey: "feeding") != nil { eng.configure(["feeding": defaults.bool(forKey: "feeding")]) }
        if defaults.object(forKey: "potty") != nil { eng.configure(["potty": defaults.bool(forKey: "potty")]) }
        island.setConfig(clock: eng.configClock, reunion: eng.configReunion)
        if debug {
            say("ENGINE loaded=\(eng.loaded.joined(separator: ",")) res=\(res) unit=\(unit) probeMs=\(String(format: "%.1f", jitMs)) jit=\(jitFast ? "fast" : "slow") sense=\(eng.hasSense) lawn=\(eng.hasLawn)")
        }
    }

    private func engineFailed(_ why: String) {
        say("球球：玩法没能跑起来（\(why)）")
        if selfTestPath != nil {
            say("SELFTEST FAIL engine: \(why)")
            exit(1)
        }
    }

    // MARK: 屏幕和版面

    func targetScreen() -> NSScreen? {
        let screens = NSScreen.screens
        if screens.isEmpty { return nil }
        let i = defaults.integer(forKey: "screen")
        return screens[min(max(i, 0), screens.count - 1)]
    }

    /// 量一量：屏幕多大、菜单栏和程序坞各占多少、有没有刘海
    func readGeometry() -> ScreenGeometry {
        var g = ScreenGeometry()
        guard let sc = targetScreen() else { return g }
        let f = sc.frame, v = sc.visibleFrame
        g.frame = f
        g.top = f.maxY - v.maxY
        g.bottom = v.minY - f.minY
        g.left = v.minX - f.minX
        g.right = f.maxX - v.maxX
        g.barH = max(22, g.top)
        g.backing = sc.backingScaleFactor
        g.notchW = 0
        g.notchMid = f.width / 2
        if #available(macOS 12.0, *) {
            // 有刘海的屏幕：量出刘海多宽多高、中心在哪
            if sc.safeAreaInsets.top > 0, let l = sc.auxiliaryTopLeftArea, let r = sc.auxiliaryTopRightArea {
                let w = f.width - l.width - r.width
                if w > 20 {
                    g.notchW = w
                    g.barH = sc.safeAreaInsets.top
                    g.notchMid = l.width + w / 2
                }
            }
        }
        if g.top < 1 { g.top = 24 }      // 菜单栏自动隐藏：还是给它留出位置
        return g
    }

    /// 大小只记"小 / 中 / 大"（2 / 3 / 4）。真正一个世界单位几 pt、画成几个像素要看屏幕：
    /// 画出来的一个像素必须正好是整数个屏幕像素，不然会一格宽一格窄。
    static func pickScale(choice: Int, backing: CGFloat, baseRes: Int) -> (unit: CGFloat, res: Int) {
        let want = CGFloat(min(max(choice, 2), 4))
        let b: CGFloat = backing > 0 ? backing : 1
        // 先试设定里的精细度，不行再试相邻的
        for r in [baseRes, baseRes + 1, baseRes - 1, baseRes + 2, baseRes - 2] where r >= 1 && r <= 4 {
            let dots = want * b / CGFloat(r)             // 画出来的一个像素是几个屏幕像素
            if dots >= 1 && abs(dots - dots.rounded()) < 0.001 { return (want, r) }
        }
        // 怎么都凑不成整数：精细度不动，大小挪到最近的整数格
        let r = min(max(baseRes, 1), 4)
        let dots = max(1, (want * b / CGFloat(r)).rounded())
        return (dots * CGFloat(r) / b, r)
    }

    /// 屏幕、程序坞、大小有变化（或者 force）时：窗口、图层、引擎、草地都跟着改
    func applyGeometry(force: Bool) {
        let g = readGeometry()
        let pick = AppDelegate.pickScale(choice: defaults.integer(forKey: "scale"), backing: g.backing,
                                         baseRes: engine?.baseRes ?? 2)
        if !force && g == geo && pick.unit == unit && pick.res == res { return }
        geo = g
        unit = pick.unit
        res = pick.res
        if panel.frame != g.frame { panel.setFrame(g.frame, display: true) }
        let W = g.frame.width, H = g.frame.height
        // 画面按世界单位算有多大。底边对着屏幕底边，不够一格的那一点留在顶上。
        viewW = Double((W / unit).rounded(.down))
        viewH = Double((H / unit).rounded(.down))
        offTop = H - CGFloat(viewH) * unit

        CATransaction.begin()
        CATransaction.setDisableActions(true)
        sprites.container.frame = CGRect(x: 0, y: 0, width: W, height: H)
        island.configure(viewSize: g.frame.size, centerX: g.notchMid, notchW: g.notchW, barH: g.barH, backing: g.backing)
        CATransaction.commit()

        let insets: [String: Any] = [
            "top": Double(max(0, g.top - offTop) / unit),
            "bottom": Double(g.bottom / unit),
            "left": Double(g.left / unit),
            "right": Double(g.right / unit),
        ]
        let view: [String: Any] = ["w": viewW, "h": viewH]
        engine?.configure(["view": view, "insets": insets, "res": res])
        if debug {
            say("LAYOUT screen=\(Int(W))x\(Int(H)) backing=\(g.backing) unit=\(unit) res=\(res) view=\(Int(viewW))x\(Int(viewH)) top=\(Int(g.top)) bottom=\(Int(g.bottom)) notch=\(Int(g.notchW)) bar=\(Int(g.barH))")
        }
        refreshLawn()
        kick()
    }

    @objc func screensChanged() { applyGeometry(force: false) }

    /// 画面的大小变了（比如挪到了另一种屏幕上）
    func backingChanged() { applyGeometry(force: false) }

    /// 世界单位 → 面板里的 pt（从上往下算）
    func toPanel(_ x: Double, _ y: Double) -> CGPoint {
        return CGPoint(x: CGFloat(x) * unit, y: offTop + CGFloat(y) * unit)
    }

    /// 面板里的 pt → 世界单位
    func toWorld(_ p: CGPoint) -> (x: Double, y: Double) {
        if unit <= 0 { return (0, 0) }
        return (Double(p.x / unit), Double((p.y - offTop) / unit))
    }

    private func buildWindow() {
        let f = geo.frame
        panel = PetPanel(contentRect: f, styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        panel.isOpaque = false
        panel.backgroundColor = NSColor.clear
        panel.hasShadow = false
        panel.isFloatingPanel = true
        panel.hidesOnDeactivate = false
        // 比菜单栏再高一点：这样岛能画在菜单栏 / 刘海那一条上；系统弹出的菜单仍然在我们上面。
        // 注意：一定要写在 isFloatingPanel 后面——设 isFloatingPanel 会把层级改回"浮动"那一层。
        var level = NSWindow.Level.mainMenu.rawValue + 3
        if let s = ProcessInfo.processInfo.environment["QIUQIU_LEVEL"], let v = Int(s) { level = v }   // 调试用
        panel.level = NSWindow.Level(rawValue: level)
        panel.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]
        panel.ignoresMouseEvents = true
        panel.isReleasedWhenClosed = false
        panel.isMovable = false
        panel.isExcludedFromWindowsMenu = true
        panel.animationBehavior = .none
        panel.title = "QiuQiu"
        panel.debugLog = debug

        // 从后到前：角色和小东西、说话的气泡、岛
        stageView = StageView(frame: CGRect(origin: .zero, size: f.size))
        stageView.owner = self
        if let root = stageView.layer {
            root.addSublayer(sprites.container)
            root.addSublayer(bubble.root)
            root.addSublayer(island.layer)
        }
        panel.contentView = stageView
        panel.orderFrontRegardless()
    }

    // MARK: 草地

    /// 设定里的草地：full 整个桌面 | strip 底下一条 | off 不要
    func lawnMode() -> String {
        let m = defaults.string(forKey: "lawn") ?? "full"
        return (m == "full" || m == "strip") ? m : "off"
    }

    /// 要不要告诉引擎"脚下是草地"（影子深一点，打滚会带起草屑）
    func grassOn(_ eng: PetEngine?) -> Bool {
        guard let e = eng, e.hasLawn else { return false }
        let m = lawnMode()
        return m == "full" || (m == "strip" && !defaults.bool(forKey: "roam"))
    }

    /// 现在草地该用哪套颜色：白天 / 傍晚 / 夜里（引擎有说就听引擎的）
    func currentPhase() -> String {
        if let p = status.phase, p == "day" || p == "dusk" || p == "night" { return p }
        let h = Calendar.current.component(.hour, from: Date())
        if h >= 19 || h < 5 { return "night" }
        if h >= 17 || h < 7 { return "dusk" }
        return "day"
    }

    func refreshLawn() {
        // JavaScript 跑得慢的机器上，草地画粗一点（不然要画好几秒）
        lawn.update(engine: engine, mode: lawnMode(), screenFrame: geo.frame, unit: unit, res: jitFast ? res : 1,
                    phase: lawnPhase, bottomInset: geo.bottom, visible: !hiddenByUser)
        if debug {
            say("LAWN \(lawn.shownMode) \(lawn.pixelW)x\(lawn.pixelH) phase=\(lawnPhase) \(String(format: "%.0f", lawn.lastMs))ms")
        }
    }
}
