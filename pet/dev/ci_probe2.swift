// 只给 CI 用的小实验（v3 原生方案的可行性）：
//   1) JavaScriptCore 里跑现在的狗骨架渲染，量每帧多少毫秒
//   2) 把 JS 里的像素数组直接变成 CGImage，贴到 CALayer 上（最近邻放大，不能糊）
//   3) 在"桌面层"开一个窗口画一块草绿色：应该在壁纸之上、桌面图标和所有 App 窗口之下
// 用法：ci_probe2 <dogs.js 的路径> <桌面层方案：desktop | belowIcons>
import Cocoa
import JavaScriptCore

let args = CommandLine.arguments
let jsPath = args.count > 1 ? args[1] : "pet/web/dogs.js"
let deskMode = args.count > 2 ? args[2] : "belowIcons"

setvbuf(stdout, nil, _IOLBF, 0)

// ---------- 1. JavaScriptCore ----------
let ctx = JSContext()!
ctx.exceptionHandler = { _, e in print("JS EXCEPTION \(e?.toString() ?? "?")") }
ctx.evaluateScript("var window = this;")
guard let src = try? String(contentsOfFile: jsPath, encoding: .utf8) else { print("cannot read \(jsPath)"); exit(2) }
ctx.evaluateScript(src, withSourceURL: URL(fileURLWithPath: jsPath))
let bench = ctx.evaluateScript("""
(function(){
  var out = {};
  ['gold','dax'].forEach(function(kind){
    var rig = window.PET_DOGS.create(kind, kind === 'gold' ? 'gold' : 'dax_red');
    var o = null, t = Date.now(), N = 1200;
    for (var i = 0; i < N; i++) { rig.update(1/60, {pose:'stand', speed: 150, wag: 1, pant: true}); o = rig.render(false); }
    out[kind] = { msPerFrame: (Date.now() - t) / N, w: o.w, h: o.h };
    if (kind === 'gold') window.__out = o;
  });
  // 纯计算：看看 JIT 开没开（开了的话这段会非常快）
  var t2 = Date.now(), s = 0; for (var k = 0; k < 30000000; k++) { s = (s + k * 7) % 1000003; }
  out.loopMs = Date.now() - t2; out.s = s;
  return JSON.stringify(out);
})()
""")
print("JSC bench \(bench?.toString() ?? "nil")")

// ---------- 2. 像素数组 → CGImage ----------
func makeImage() -> CGImage? {
    guard let o = ctx.objectForKeyedSubscript("__out"), !o.isUndefined else { return nil }
    let w = Int(o.objectForKeyedSubscript("w").toInt32()), h = Int(o.objectForKeyedSubscript("h").toInt32())
    guard let dataVal = o.objectForKeyedSubscript("data") else { return nil }
    let jsctx = ctx.jsGlobalContextRef
    var exc: JSValueRef? = nil
    guard let obj = JSValueToObject(jsctx, dataVal.jsValueRef, &exc) else { print("not an object"); return nil }
    let type = JSValueGetTypedArrayType(jsctx, dataVal.jsValueRef, &exc)
    let len = JSObjectGetTypedArrayByteLength(jsctx, obj, &exc)
    guard let ptr = JSObjectGetTypedArrayBytesPtr(jsctx, obj, &exc) else { print("no bytes ptr"); return nil }
    print("typed array type=\(type.rawValue) bytes=\(len) expected=\(w * h * 4)")
    var bytes = [UInt8](repeating: 0, count: len)
    memcpy(&bytes, ptr, len)
    var opaque = 0
    var i = 0
    while i < len {            // 直通 alpha → 预乘 alpha
        let a = Int(bytes[i + 3])
        if a > 0 { opaque += 1 }
        if a < 255 { bytes[i] = UInt8(Int(bytes[i]) * a / 255); bytes[i + 1] = UInt8(Int(bytes[i + 1]) * a / 255); bytes[i + 2] = UInt8(Int(bytes[i + 2]) * a / 255) }
        i += 4
    }
    print("opaque pixels in the JS buffer: \(opaque)")
    guard let provider = CGDataProvider(data: Data(bytes) as CFData) else { return nil }
    return CGImage(width: w, height: h, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: w * 4,
                   space: CGColorSpace(name: CGColorSpace.sRGB)!,
                   bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue),
                   provider: provider, decode: nil, shouldInterpolate: false, intent: .defaultIntent)
}

final class Probe: NSObject, NSApplicationDelegate {
    var overlay: NSPanel!
    var desk: NSWindow!
    func applicationDidFinishLaunching(_ n: Notification) {
        let screen = NSScreen.screens.first!
        let f = screen.frame
        print("screen \(Int(f.width))x\(Int(f.height)) backing=\(screen.backingScaleFactor)")
        print("level desktopWindow=\(CGWindowLevelForKey(.desktopWindow)) desktopIcon=\(CGWindowLevelForKey(.desktopIconWindow)) normal=\(CGWindowLevelForKey(.normalWindow))")

        // ---- 3. 桌面层窗口：下半屏画草绿色 ----
        desk = NSWindow(contentRect: f, styleMask: [.borderless], backing: .buffered, defer: false)
        let lvl = deskMode == "desktop" ? Int(CGWindowLevelForKey(.desktopWindow)) : Int(CGWindowLevelForKey(.desktopIconWindow)) - 1
        desk.level = NSWindow.Level(rawValue: lvl)
        desk.isOpaque = false
        desk.backgroundColor = NSColor.clear
        desk.hasShadow = false
        desk.ignoresMouseEvents = true
        desk.isReleasedWhenClosed = false
        desk.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]
        desk.title = "ProbeDesk"
        let dv = NSView(frame: CGRect(origin: .zero, size: f.size))
        dv.wantsLayer = true
        let lawn = CALayer()
        lawn.frame = CGRect(x: 0, y: 0, width: f.width, height: f.height * 0.55)
        lawn.backgroundColor = NSColor(calibratedRed: 0.45, green: 0.72, blue: 0.36, alpha: 1).cgColor
        dv.layer?.addSublayer(lawn)
        desk.contentView = dv
        desk.orderFrontRegardless()
        print("desk window level set to \(lvl), actual \(desk.level.rawValue), number \(desk.windowNumber)")

        // ---- 2. 置顶窗口：把狗的像素贴上去，最近邻放大 ----
        overlay = NSPanel(contentRect: f, styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        overlay.isOpaque = false
        overlay.backgroundColor = NSColor.clear
        overlay.hasShadow = false
        overlay.isFloatingPanel = true
        overlay.hidesOnDeactivate = false
        overlay.level = NSWindow.Level(rawValue: NSWindow.Level.mainMenu.rawValue + 3)
        overlay.ignoresMouseEvents = true
        overlay.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]
        overlay.title = "ProbeOverlay"
        let ov = NSView(frame: CGRect(origin: .zero, size: f.size))
        ov.wantsLayer = true
        if let img = makeImage() {
            let scales: [CGFloat] = [3, 1.5, 2]
            var x: CGFloat = 80
            for s in scales {
                let l = CALayer()
                l.contents = img
                l.magnificationFilter = .nearest
                l.minificationFilter = .nearest
                l.contentsScale = screen.backingScaleFactor
                l.frame = CGRect(x: x, y: f.height * 0.5, width: CGFloat(img.width) * s, height: CGFloat(img.height) * s)
                l.actions = ["contents": NSNull(), "position": NSNull(), "bounds": NSNull()]
                ov.layer?.addSublayer(l)
                x += CGFloat(img.width) * s + 30
            }
            // 水平翻转的一份
            let fl = CALayer()
            fl.contents = img
            fl.magnificationFilter = .nearest
            fl.frame = CGRect(x: x, y: f.height * 0.5, width: CGFloat(img.width) * 3, height: CGFloat(img.height) * 3)
            fl.setAffineTransform(CGAffineTransform(scaleX: -1, y: 1))
            ov.layer?.addSublayer(fl)
            print("layers added, image \(img.width)x\(img.height)")
        } else {
            print("NO IMAGE")
        }
        overlay.contentView = ov
        overlay.orderFrontRegardless()
        print("PROBE2 ready")
    }
}
let app = NSApplication.shared
let d = Probe()
app.delegate = d
app.setActivationPolicy(.accessory)
app.run()
