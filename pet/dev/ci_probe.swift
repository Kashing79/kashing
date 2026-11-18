// 只给 CI 用的小实验：在屏幕上放一个透明的置顶窗口，里面画几块颜色，
// 用来查清楚"某个系统版本上看不到东西"到底是窗口的问题、网页的问题，还是画布的问题。
// 用法：ci_probe <窗口层级> <native|web|webopaque> [gpuoff]
import Cocoa
import WebKit

let args = CommandLine.arguments
let level = Int(args.count > 1 ? args[1] : "27") ?? 27
let mode = args.count > 2 ? args[2] : "native"
let gpuOff = args.contains("gpuoff")

let html = """
<html><body style='margin:0;background:transparent'>
<div style='position:fixed;left:60px;top:200px;width:150px;height:90px;background:#0050ff'></div>
<canvas id=c width=75 height=45 style='position:fixed;left:260px;top:200px;width:150px;height:90px;image-rendering:pixelated'></canvas>
<canvas id=g width=150 height=90 style='position:fixed;left:460px;top:200px;width:150px;height:90px'></canvas>
<script>
var x=document.getElementById('c').getContext('2d'); x.fillStyle='#00c000'; x.fillRect(0,0,75,45);
var y=document.getElementById('g').getContext('2d',{willReadFrequently:true}); y.fillStyle='#ff9000'; y.fillRect(0,0,150,90);
var t=0; function f(){ t++; x.clearRect(0,0,75,45); x.fillStyle='#00c000'; x.fillRect(0,0,75,45); x.fillStyle='#fff'; x.fillRect(t%60,10,6,6); requestAnimationFrame(f); } requestAnimationFrame(f);
function probe(){ var d=x.getImageData(0,0,75,45).data,n=0; for(var i=3;i<d.length;i+=4) if(d[i]>0) n++; return 'frames='+t+' canvasPixels='+n; }
</script></body></html>
"""

final class D: NSObject, NSApplicationDelegate, WKNavigationDelegate {
    var panel: NSPanel!
    var web: WKWebView?
    func applicationDidFinishLaunching(_ n: Notification) {
        let f = NSScreen.screens.first!.frame
        panel = NSPanel(contentRect: f, styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        panel.isOpaque = false
        panel.backgroundColor = NSColor.clear
        panel.hasShadow = false
        panel.isFloatingPanel = true
        panel.hidesOnDeactivate = false
        panel.level = NSWindow.Level(rawValue: level)
        panel.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]
        panel.ignoresMouseEvents = true
        panel.title = "Probe"
        let content = NSView(frame: CGRect(origin: .zero, size: f.size))
        if mode == "native" {
            let v = NSView(frame: CGRect(x: 60, y: f.height - 290, width: 150, height: 90))
            v.wantsLayer = true
            v.layer?.backgroundColor = NSColor.red.cgColor
            content.addSubview(v)
        } else {
            let conf = WKWebViewConfiguration()
            if mode == "web", conf.responds(to: Selector(("_setDrawsBackground:"))) { conf.setValue(false, forKey: "drawsBackground") }
            if gpuOff {
                // 试试把"画布交给显卡进程画"关掉
                let p = conf.preferences
                for key in ["acceleratedDrawingEnabled", "canvasUsesAcceleratedDrawing", "acceleratedCompositingEnabled"] {
                    let sel = Selector(("_set" + key.prefix(1).uppercased() + key.dropFirst() + ":"))
                    print("PROBE pref \(key) responds=\(p.responds(to: sel))")
                }
                if p.responds(to: Selector(("_setCanvasUsesAcceleratedDrawing:"))) { p.setValue(false, forKey: "canvasUsesAcceleratedDrawing") }
                if p.responds(to: Selector(("_setAcceleratedDrawingEnabled:"))) { p.setValue(false, forKey: "acceleratedDrawingEnabled") }
            }
            let w = WKWebView(frame: content.bounds, configuration: conf)
            if mode == "web" {
                if w.responds(to: Selector(("_setDrawsBackground:"))) { w.setValue(false, forKey: "drawsBackground") }
                if #available(macOS 12.0, *) { w.underPageBackgroundColor = NSColor.clear }
            }
            w.navigationDelegate = self
            w.loadHTMLString(html, baseURL: nil)
            content.addSubview(w)
            web = w
        }
        panel.contentView = content
        panel.orderFrontRegardless()
        print("PROBE started level=\(level) mode=\(mode) gpuOff=\(gpuOff) windowNumber=\(panel.windowNumber)")
        fflush(stdout)
        Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { [weak self] _ in
            self?.web?.evaluateJavaScript("probe()") { r, e in
                print("PROBE js \(r as? String ?? "nil") \(e == nil ? "" : String(describing: e!))"); fflush(stdout)
            }
        }
    }
}
let app = NSApplication.shared
let d = D()
app.delegate = d
app.setActivationPolicy(.accessory)
app.run()
