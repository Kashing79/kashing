// 球球 · 引擎交过来的东西长什么样
//
//   · 一帧：一张从后到前的清单（每一项：哪张图、贴在哪）、可以点的范围、小人在说的话
//   · 引擎现在的状态（在外面 / 在岛里、今天丢了几次球……）
//   · 把 JavaScript 那边拿回来的值小心地变成数字 / 开关 / 文字
//   · 把一块 RGBA 像素变成一张图

import Cocoa

// MARK: - 一帧里有什么

/// 清单里的一项：一张图贴在哪里
struct SpriteItem {
    var id: String
    var texKey: String      // 这张图的名字（没名字的是 "#编号"）
    var ver: Int            // 像素每变一次加一
    var x: Double           // 左上角（世界单位）
    var y: Double
    var w: Double           // 图有多大（世界单位）
    var h: Double
    var flip: Bool
    var alpha: Double
    var image: CGImage?
    var clip: CGRect? = nil // 只画图在这个方框里的部分（世界单位）；nil = 整张都画
}

/// 一帧
struct StageFrame {
    var items: [SpriteItem] = []
    var hot: [CGRect] = []          // 可以点的范围（世界单位）
    var decals: [SpriteItem] = []   // 草地上的印记（画在桌面草地那个窗口里）
    var overlayDecals: [SpriteItem] = []    // 没有草地时，其中可以画在最上面那层的几个
    var drag = false                // 她正拖着球 / 拎着谁
    var bubbleText: String? = nil   // 小人在说的话
    var bubbleX = 0.0               // 他头顶在哪（世界单位）
    var bubbleY = 0.0
    var bubbleId = 0
    var home = "out"
    var busy = 2
}

/// 在岛里睡觉时，岛上那一小格里画什么
struct DenFrame {
    var w = 0.0
    var h = 0.0
    var items: [SpriteItem] = []
}

/// 喂饭、便便那一套（引擎有才有）
struct CareStatus {
    var meal = "idle"           // idle | due | serving
    var kind: String? = nil     // full | snack | biscuit
    var meals = 0
    var poops = 0
    var fedByHer = 0
    var byHer = 0
    var lucky = false
    var feeding = true
    var potty = true
}

struct EngineStatus {
    var home = "out"            // out | going | in | leaving
    var fetch = 0
    var pets = 0
    var night = false
    var auto = true
    var roam = true
    var scene = ""
    var phase: String? = nil    // day | dusk | night
    var care: CareStatus? = nil
}

/// 从 JavaScript 那边拿回来的值，小心地变成数字 / 开关 / 文字
enum JSRead {
    static func at(_ a: [Any], _ i: Int) -> Any? { return (i >= 0 && i < a.count) ? a[i] : nil }
    static func double(_ v: Any?) -> Double {
        guard let n = v as? NSNumber else { return 0 }
        let d = n.doubleValue
        return d.isFinite ? d : 0
    }
    static func int(_ v: Any?) -> Int {
        let d = double(v)
        if d > 1e9 || d < -1e9 { return 0 }
        return Int(d)
    }
    static func flag(_ v: Any?) -> Bool {
        guard let n = v as? NSNumber else { return false }
        return n.boolValue
    }
    static func string(_ v: Any?) -> String { return (v as? String) ?? "" }

    static func status(_ d: [String: Any]) -> EngineStatus {
        var s = EngineStatus()
        let h = string(d["home"])
        if !h.isEmpty { s.home = h }
        s.fetch = int(d["fetch"])
        s.pets = int(d["pets"])
        s.night = flag(d["night"])
        s.auto = d["auto"] == nil ? true : flag(d["auto"])
        s.roam = d["roam"] == nil ? true : flag(d["roam"])
        s.scene = string(d["scene"])
        let p = string(d["phase"])
        if !p.isEmpty { s.phase = p }
        if let c = d["care"] as? [String: Any] {
            var k = CareStatus()
            let m = string(c["meal"])
            if !m.isEmpty { k.meal = m }
            let kind = string(c["kind"])
            if !kind.isEmpty { k.kind = kind }
            k.meals = int(c["meals"])
            k.poops = int(c["poops"])
            k.fedByHer = int(c["fedByHer"])
            k.byHer = int(c["byHer"])
            k.lucky = flag(c["lucky"])
            k.feeding = c["feeding"] == nil ? true : flag(c["feeding"])
            k.potty = c["potty"] == nil ? true : flag(c["potty"])
            s.care = k
        }
        return s
    }
}

// MARK: - 像素 → 图

enum Pixels {
    /// 抄一份像素，顺手把"直通 alpha"换成显卡要的"预乘 alpha"
    static func premultiplied(_ src: UnsafeRawPointer, _ count: Int) -> Data {
        var data = Data(count: count)
        data.withUnsafeMutableBytes { (raw: UnsafeMutableRawBufferPointer) -> Void in
            guard let base = raw.baseAddress else { return }
            memcpy(base, src, count)
            let p = base.assumingMemoryBound(to: UInt8.self)
            var i = 0
            while i + 3 < count {
                let a = Int(p[i + 3])
                if a == 0 {
                    p[i] = 0; p[i + 1] = 0; p[i + 2] = 0
                } else if a < 255 {
                    p[i] = UInt8((Int(p[i]) * a + 127) / 255)
                    p[i + 1] = UInt8((Int(p[i + 1]) * a + 127) / 255)
                    p[i + 2] = UInt8((Int(p[i + 2]) * a + 127) / 255)
                }
                i += 4
            }
        }
        return data
    }

    /// 一块（预乘好的）RGBA 像素 → 一张图。放大时不抹匀。
    static func image(_ data: Data, width: Int, height: Int) -> CGImage? {
        guard width > 0, height > 0, data.count >= width * height * 4 else { return nil }
        guard let provider = CGDataProvider(data: data as CFData) else { return nil }
        let space = CGColorSpace(name: CGColorSpace.sRGB) ?? CGColorSpaceCreateDeviceRGB()
        return CGImage(width: width, height: height, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: width * 4,
                       space: space, bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue),
                       provider: provider, decode: nil, shouldInterpolate: false, intent: .defaultIntent)
    }
}
