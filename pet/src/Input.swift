// 球球 · 鼠标
//
// 窗口铺满了整个屏幕，平时鼠标直接穿过去。每秒 30 次看一眼鼠标在哪：
// 移到小球、角色、岛上（引擎给的"可以点的范围" + 岛自己的范围）才把窗口换成"接住鼠标"。
// 几条保险（都是在真机上踩过的坑）：
//   · 按下去的那一下必须落在可以点的范围里（放宽 8pt）才算数
//   · 她按着鼠标拖别的东西路过时，不去抢
//   · 鼠标早就松开了、我们却还以为在拖：过 12 拍强制结束
// 岛先挑：落在岛上的归岛管；但她正拖着球 / 拎着谁的时候，岛不插手。

import Cocoa
import QuartzCore

/// 永远不抢键盘焦点的面板：点它不会让正在打字的 App 失去焦点。
final class PetPanel: NSPanel {
    var debugLog = false
    override var canBecomeKey: Bool { return false }
    override var canBecomeMain: Bool { return false }
    override func sendEvent(_ event: NSEvent) {
        if debugLog && (event.type == .leftMouseDown || event.type == .leftMouseUp) {
            say("PANEL event \(event.type == .leftMouseDown ? "down" : "up") appActive=\(NSApp.isActive) ignores=\(ignoresMouseEvents)")
        }
        super.sendEvent(event)
    }
}

/// 整个画面就是这一个 View：里面是一层层的图（我们自己管），鼠标事件也由它转交。
final class StageView: NSView {
    weak var owner: AppDelegate?

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        let root = CALayer()
        root.actions = SpriteLayers.noActions
        layer = root
        wantsLayer = true
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) is not used")
    }

    override var isOpaque: Bool { return false }
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { return true }
    override func mouseDown(with event: NSEvent) { owner?.forwardMouse("down", event) }
    override func mouseDragged(with event: NSEvent) { owner?.forwardMouse("move", event) }
    override func mouseUp(with event: NSEvent) { owner?.forwardMouse("up", event) }
    override func rightMouseDown(with event: NSEvent) { owner?.popUpMenu(with: event) }
    override func viewDidChangeBackingProperties() {
        super.viewDidChangeBackingProperties()
        owner?.backingChanged()
    }
}

extension AppDelegate {

    /// 现在所有可以点的范围：球、金毛、小人、小腊肠、（别的小东西）……岛排在最后
    func allHot() -> [CGRect] {
        var list = petHot
        if let r = island.rect { list.append(r) }
        return list
    }

    /// 每秒 30 次：看看鼠标在不在它们身上，决定窗口要不要"接住"鼠标。
    func pollMouse(_ now: CFTimeInterval) {
        let m = NSEvent.mouseLocation
        let f = panel.frame
        let local = CGPoint(x: m.x - f.minX, y: f.maxY - m.y)
        cursor = local
        cursorOn = local.x >= 0 && local.y >= 0 && local.x <= f.width && local.y <= f.height

        // 窗口铺满了屏幕，所以只在鼠标靠近它们时才把位置告诉引擎
        let hot = allHot()
        var over = false
        var near = false
        for r in hot {
            if r.contains(local) { over = true; near = true; break }
            if r.insetBy(dx: -130, dy: -130).contains(local) { near = true }
        }
        let buttons = NSEvent.pressedMouseButtons

        // 保险：鼠标早就松开了，但我们还以为在拖 → 强制结束
        if (mouseDownInside || jsDragging) && buttons == 0 {
            stuckTicks += 1
            if stuckTicks > 12 {
                stuckTicks = 0
                forceMouseUp()
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
            if debug { say("INTERACTIVE \(want ? 1 : 0)") }
        }
        if debug && tickCount % 5 == 0 { debugHot(hot) }

        // 岛：鼠标停一小会儿就弹开（她正拖着球 / 拎着谁的时候不弹）
        island.hover(local, mouseDown: buttons != 0, dragging: jsDragging, now: now)

        if !mouseDownInside {
            if near {
                hoverTicks += 1
                if !hoverNear || abs(local.x - lastHover.x) > 0.5 || abs(local.y - lastHover.y) > 0.5 || hoverTicks % 9 == 0 {
                    hoverNear = true
                    lastHover = local
                    let w = toWorld(local)
                    engine?.pointer("hover", w.x, w.y)
                }
            } else if hoverNear {
                hoverNear = false
                engine?.pointer("leave", 0, 0)
            }
        }
    }

    /// 画面那个 View 收到的鼠标按下 / 拖动 / 松开
    func forwardMouse(_ type: String, _ event: NSEvent) {
        let p = event.locationInWindow
        let h = stageView.bounds.height
        let pt = CGPoint(x: p.x, y: h - p.y)        // 面板里的位置，从上往下算
        let x = Int(pt.x.rounded()), y = Int(pt.y.rounded())
        if type == "down" {
            // 只有真的点在小人 / 小狗 / 小球 / 岛上才算数，
            // 其他地方的点击一律不理（免得鼠标刚离开它们的那一瞬间误触发）。
            var hit = false
            for r in allHot() where r.insetBy(dx: -8, dy: -8).contains(pt) { hit = true; break }
            if !hit {
                if debug { say("MOUSE miss \(x) \(y)") }
                return
            }
            mouseDownInside = true
            islandOwnsMouse = false
            if !jsDragging && island.contains(pt) { islandOwnsMouse = island.mouseDown(pt) }
        } else if !mouseDownInside && !jsDragging {
            return
        }
        if type == "up" { mouseDownInside = false }
        if debug && type != "move" { say("MOUSE \(type) \(x) \(y)") }

        if islandOwnsMouse {
            if type == "up" {
                islandOwnsMouse = false
                if let command = island.mouseUp(pt) {
                    engine?.command(command)
                }
            }
        } else {
            let w = toWorld(pt)
            engine?.pointer(type, w.x, w.y)
        }
        if type != "move" { kick() }
    }

    /// 不管现在在干什么，都当作鼠标松开了
    func forceMouseUp() {
        let wasDown = mouseDownInside || jsDragging
        mouseDownInside = false
        jsDragging = false
        if islandOwnsMouse {
            islandOwnsMouse = false
            island.cancelPress()
        } else if wasDown {
            engine?.pointer("up", 0, 0)
        }
        if wasDown { kick() }
    }

    /// 停下来之前：把鼠标还回去（窗口重新变成"穿透"）
    func releaseMouse() {
        if mouseDownInside || jsDragging { forceMouseUp() }
        if hoverNear {
            hoverNear = false
            engine?.pointer("leave", 0, 0)
        }
        if interactive {
            interactive = false
            panel.ignoresMouseEvents = true
            if debug { say("INTERACTIVE 0") }
        }
    }

    /// 调试用：把可点范围换算成整块屏幕的坐标（原点在主屏左上角）打印出来。
    /// 顺序：小球、金毛、小人、小腊肠……岛在最后。
    func debugHot(_ hot: [CGRect]) {
        let f = panel.frame
        let sh = NSScreen.screens.first?.frame.height ?? 0
        var parts: [String] = []
        for r in hot {
            let gx = f.minX + r.minX
            let gy = (sh - f.maxY) + r.minY
            parts.append("\(Int(gx)),\(Int(gy)),\(Int(r.width)),\(Int(r.height))")
        }
        say("HOT \(parts.joined(separator: " "))")
    }
}
