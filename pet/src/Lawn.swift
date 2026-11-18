// 球球 · 桌面上的草地
//
// 另开一个窗口，放在"桌面图标"的下面一层：壁纸之上，桌面图标、程序坞和所有 App 窗口之下。
// 鼠标直接穿过去，每个桌面（Space）上都有。草地由 web/lawn.js 画，整张画好以后当一张图贴上去，
// 放大时不抹匀；格子和小人、狗狗的像素格子是对齐的（都从屏幕左下角数起）。
//   full   整个桌面都是草地
//   strip  只在最下面一条：草带的下沿对着它们站的地方（程序坞的上沿），再往下到屏幕底也接着铺
//   off    不要草地
// 没有 lawn.js 的话，这个窗口根本不会建。

import Cocoa
import QuartzCore

final class Lawn {
    private var window: NSWindow?
    private let layer = CALayer()
    private var shownKey = ""
    private(set) var shownMode = "off"
    private(set) var pixelW = 0
    private(set) var pixelH = 0
    private(set) var lastMs = 0.0           // 上一次画花了多久

    /// 该是什么样就变成什么样；什么都没变就不重画。
    ///   unit         一个世界单位几 pt
    ///   res          一个世界单位画成几个像素
    ///   bottomInset  程序坞占了屏幕底下多少 pt
    func update(engine: PetEngine?, mode: String, screenFrame f: CGRect, unit: CGFloat, res: Int,
                phase: String, bottomInset: CGFloat, visible: Bool) {
        guard let eng = engine, eng.hasLawn, mode == "full" || mode == "strip", unit > 0, f.width > 0, f.height > 0 else {
            remove()
            return
        }
        let win = ensureWindow(f)
        let wWu = ceil(f.width / unit), hWu = ceil(f.height / unit)
        let floorWu: CGFloat = bottomInset > 0.5 ? ceil(bottomInset / unit) : 0
        let key = "\(mode)|\(phase)|\(Int(wWu))x\(Int(hWu))@\(res)|\(unit)|\(Int(floorWu))"
        if key != shownKey {
            shownKey = key
            let t0 = CACurrentMediaTime()
            var image: CGImage? = nil
            var scale = Double(res)
            if mode == "full" {
                if let px = eng.lawnPixels(w: Double(wWu), h: Double(hWu), phase: phase, res: res, mode: "full") {
                    image = Pixels.image(px.data, width: px.width, height: px.height)
                    pixelW = px.width
                    pixelH = px.height
                    scale = px.scale
                }
            } else {
                let bandWu = min(hWu, 60)
                if let px = eng.lawnPixels(w: Double(wWu), h: Double(bandWu), phase: phase, res: res, mode: "strip") {
                    // 草带下面（程序坞那一截）接着铺：把草带最底下那几行来回镜像着抄下去，接缝处看不出来
                    let extra = Int((floorWu * CGFloat(px.scale)).rounded())
                    let ext = Lawn.extendDown(px.data, width: px.width, height: px.height, extra: extra,
                                              maxTile: Int(18 * px.scale))
                    image = Pixels.image(ext.data, width: px.width, height: ext.height)
                    pixelW = px.width
                    pixelH = ext.height
                    scale = px.scale
                }
            }
            lastMs = (CACurrentMediaTime() - t0) * 1000.0
            CATransaction.begin()
            CATransaction.setDisableActions(true)
            if let img = image, scale > 0 {
                let dot = unit / CGFloat(scale)                 // 一个像素是几 pt
                layer.contents = img
                layer.bounds = CGRect(x: 0, y: 0, width: CGFloat(pixelW) * dot, height: CGFloat(pixelH) * dot)
                layer.position = CGPoint(x: 0, y: 0)            // 左下角对着屏幕左下角
                layer.isHidden = false
                shownMode = mode
            } else {
                layer.contents = nil
                layer.isHidden = true
                shownMode = "off"
                pixelW = 0
                pixelH = 0
            }
            CATransaction.commit()
        }
        if visible {
            if !win.isVisible { win.orderFrontRegardless() }
        } else if win.isVisible {
            win.orderOut(nil)
        }
    }

    /// 草地窗口的编号（没有就是 0）
    var windowNumber: Int { return window?.windowNumber ?? 0 }

    private func remove() {
        shownKey = ""
        shownMode = "off"
        pixelW = 0
        pixelH = 0
        if let w = window {
            w.orderOut(nil)
            w.close()
            window = nil
        }
    }

    private func ensureWindow(_ f: CGRect) -> NSWindow {
        if let w = window {
            if w.frame != f { w.setFrame(f, display: true) }
            return w
        }
        let w = NSWindow(contentRect: f, styleMask: [.borderless], backing: .buffered, defer: false)
        // 比"桌面图标"那一层低一层
        w.level = NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.desktopIconWindow)) - 1)
        w.isOpaque = false
        w.backgroundColor = NSColor.clear
        w.hasShadow = false
        w.ignoresMouseEvents = true
        w.isReleasedWhenClosed = false
        w.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]
        w.isExcludedFromWindowsMenu = true
        w.animationBehavior = .none
        w.title = "QiuQiuLawn"

        let view = NSView(frame: CGRect(origin: .zero, size: f.size))
        let root = CALayer()
        root.actions = SpriteLayers.noActions
        view.layer = root
        view.wantsLayer = true
        layer.actions = SpriteLayers.noActions
        layer.magnificationFilter = .nearest
        layer.minificationFilter = .nearest
        layer.anchorPoint = CGPoint(x: 0, y: 0)
        root.addSublayer(layer)
        w.contentView = view
        window = w
        return w
    }

    /// 在图的下面多接 extra 行：把最底下那些"整行都不透明"的行（最多 maxTile 行）来回镜像着抄。
    static func extendDown(_ src: Data, width: Int, height: Int, extra: Int, maxTile: Int) -> (data: Data, height: Int) {
        let row = width * 4
        if extra <= 0 || width <= 0 || height <= 0 || maxTile < 2 || src.count < row * height { return (src, height) }
        var solid = 0
        src.withUnsafeBytes { (raw: UnsafeRawBufferPointer) -> Void in
            guard let base = raw.baseAddress else { return }
            let p = base.assumingMemoryBound(to: UInt8.self)
            var y = height - 1
            while y >= 0 && solid < maxTile {
                let o = y * row
                var x = 0
                var whole = true
                while x < width {
                    if p[o + x * 4 + 3] != 255 { whole = false; break }
                    x += 2
                }
                if !whole { break }
                solid += 1
                y -= 1
            }
        }
        if solid < 2 { return (src, height) }
        let tile = solid
        var out = Data(count: (height + extra) * row)
        out.withUnsafeMutableBytes { (dst: UnsafeMutableRawBufferPointer) -> Void in
            src.withUnsafeBytes { (raw: UnsafeRawBufferPointer) -> Void in
                guard let d = dst.baseAddress, let s = raw.baseAddress else { return }
                memcpy(d, s, height * row)
                var r = 0
                while r < extra {
                    let k = r % (2 * tile)
                    let idx = k < tile ? k : (2 * tile - 1 - k)
                    memcpy(d.advanced(by: (height + r) * row), s.advanced(by: (height - 1 - idx) * row), row)
                    r += 1
                }
            }
        }
        return (out, height + extra)
    }
}
