// 球球 · 跑玩法的那一头
//
// 玩法是 web/ 里的 JavaScript（pet.js 和几个画图的文件）。这里用系统自带的 JavaScriptCore 直接跑，不开网页。
//   · 把那几个文件读进同一个环境里（有哪个读哪个）
//   · 引擎要问外壳的几件事（现在几秒了、帮我存一下、岛在哪）由 Swift 回答
//   · 每一帧问一次"该画什么"：清单压成一个一维数组一次拿过来；像素只在变了的时候才拿
//
// 引擎还在加功能，所以它每一样"可有可无"的东西（sense / setQuality / den / 草地……）都先问有没有再用。

import Cocoa
import JavaScriptCore
import QuartzCore

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
}

/// 一帧
struct StageFrame {
    var items: [SpriteItem] = []
    var hot: [CGRect] = []          // 可以点的范围（世界单位）
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

// MARK: - 引擎

final class PetEngine {
    let context: JSContext
    private var api: JSValue?
    private(set) var created = false
    private(set) var loaded: [String] = []
    private(set) var exceptionCount = 0
    private(set) var lastException = ""
    var verbose = false

    // 引擎 / 画图的文件有没有这些
    private(set) var hasSense = false
    private(set) var hasQuality = false
    private(set) var hasDen = false
    private(set) var hasLawn = false
    private(set) var hasPerson = false
    private(set) var baseRes = 2                    // config.js 里要的精细度（一个世界单位几个像素）
    private(set) var configClock: [[String: Any]] = []
    private(set) var configReunion: String? = nil

    // 岛在哪（由外面填；单位是世界单位）
    var islandCenter: () -> Double = { return 0 }
    var islandVisible: () -> Bool = { return false }
    var islandHit: (Double, Double) -> Bool = { _, _ in return false }

    private struct Texture {
        var image: CGImage
        var ver: Int
        var pw: Int
        var ph: Int
        var used: Int
    }
    private var textures: [String: Texture] = [:]
    private var frameNo = 0
    private var windowAlias = false

    init?() {
        guard let c = JSContext() else { return nil }
        context = c
        installNative()
    }

    // MARK: 引擎要问外壳的几件事

    private func installNative() {
        context.exceptionHandler = { [weak self] _, e in
            self?.noteException(e)
        }
        let now: @convention(block) () -> Double = {
            return CACurrentMediaTime()
        }
        // "今天丢了几次球"这些小数据，存在系统给每个 App 的设定里
        let get: @convention(block) (String) -> String = { key in
            return UserDefaults.standard.string(forKey: "js." + key) ?? ""
        }
        let set: @convention(block) (String, String) -> Void = { key, value in
            UserDefaults.standard.set(value, forKey: "js." + key)
        }
        // 触控板轻轻"嗒"一下（没有这种触控板就什么都不会发生）
        let haptic: @convention(block) (String) -> Void = { kind in
            let pattern: NSHapticFeedbackManager.FeedbackPattern = (kind == "soft") ? .generic : .alignment
            NSHapticFeedbackManager.defaultPerformer.perform(pattern, performanceTime: .now)
        }
        let center: @convention(block) () -> Double = { [weak self] in
            guard let s = self else { return 0 }
            return s.islandCenter()
        }
        let visible: @convention(block) () -> Double = { [weak self] in
            guard let s = self else { return 0 }
            return s.islandVisible() ? 1 : 0
        }
        let hit: @convention(block) (Double, Double) -> Double = { [weak self] x, y in
            guard let s = self else { return 0 }
            return s.islandHit(x, y) ? 1 : 0
        }
        let log: @convention(block) (String) -> Void = { [weak self] msg in
            guard let s = self else { return }
            if s.verbose { say("JS LOG " + msg) }
        }
        context.setObject(unsafeBitCast(now, to: AnyObject.self), forKeyedSubscript: "__qq_now" as NSString)
        context.setObject(unsafeBitCast(get, to: AnyObject.self), forKeyedSubscript: "__qq_get" as NSString)
        context.setObject(unsafeBitCast(set, to: AnyObject.self), forKeyedSubscript: "__qq_set" as NSString)
        context.setObject(unsafeBitCast(haptic, to: AnyObject.self), forKeyedSubscript: "__qq_haptic" as NSString)
        context.setObject(unsafeBitCast(center, to: AnyObject.self), forKeyedSubscript: "__qq_islandCenter" as NSString)
        context.setObject(unsafeBitCast(visible, to: AnyObject.self), forKeyedSubscript: "__qq_islandVisible" as NSString)
        context.setObject(unsafeBitCast(hit, to: AnyObject.self), forKeyedSubscript: "__qq_islandHit" as NSString)
        context.setObject(unsafeBitCast(log, to: AnyObject.self), forKeyedSubscript: "__qq_log" as NSString)
    }

    /// JavaScript 出错了：打印出来（是哪个文件第几行）。同样的错刷屏的话只挑着印。
    private func noteException(_ e: JSValue?) {
        exceptionCount += 1
        var msg = "?"
        var file = ""
        var line: Int32 = 0
        if let ex = e {
            msg = ex.toString() ?? "?"
            if let l = ex.objectForKeyedSubscript("line"), l.isNumber { line = l.toInt32() }
            if let u = ex.objectForKeyedSubscript("sourceURL"), u.isString {
                file = ((u.toString() ?? "") as NSString).lastPathComponent
            }
        }
        lastException = msg
        if exceptionCount <= 12 || exceptionCount % 300 == 0 {
            say("JS EXCEPTION \(msg) (\(file):\(line))")
        }
    }

    // MARK: 读文件、建引擎

    /// 把 web/ 里的文件一个个读进来（有哪个读哪个），再读我们自己的那一小段胶水。
    func load(from dir: URL) {
        let names = ["config.js", "sprites.js", "fx.js", "dogs.js", "person.js", "lawn.js", "pet.js"]
        for name in names {
            if evaluateFile(dir.appendingPathComponent(name)) { loaded.append(name) }
        }
        // 以后的"小剧场剧本"：scenes/ 里的每个 .js（现在还没有这个文件夹）
        let scenes = dir.appendingPathComponent("scenes", isDirectory: true)
        if let list = try? FileManager.default.contentsOfDirectory(atPath: scenes.path) {
            for name in list.sorted() where name.hasSuffix(".js") {
                if evaluateFile(scenes.appendingPathComponent(name)) { loaded.append("scenes/" + name) }
            }
        }
        context.evaluateScript(PetEngine.shim, withSourceURL: URL(fileURLWithPath: "/qiuqiu/host.js"))
        if let a = context.objectForKeyedSubscript("__qq"), a.isObject { api = a }
        readFeatures()
    }

    private func evaluateFile(_ url: URL) -> Bool {
        guard FileManager.default.fileExists(atPath: url.path),
              let src = try? String(contentsOf: url, encoding: .utf8) else { return false }
        let before = exceptionCount
        context.evaluateScript(src, withSourceURL: url)
        if exceptionCount != before && !windowAlias && lastException.contains("window") {
            // 这个文件非要用 window：给它起个别名，再读一次
            windowAlias = true
            context.evaluateScript("var window = this;")
            context.evaluateScript(src, withSourceURL: url)
        }
        return true
    }

    /// 试一下这台机器上 JavaScript 跑得快不快（"即时编译"开没开，差十倍）。返回毫秒，越小越快。
    func speedProbe() -> Double {
        guard let a = api else { return 0 }
        let t0 = CACurrentMediaTime()
        a.invokeMethod("probe", withArguments: [])
        return (CACurrentMediaTime() - t0) * 1000.0
    }

    /// options：在 config.js 的设定上面再加几样（res / roam / auto / grass ……）
    func create(options: [String: Any]) -> Bool {
        guard let a = api else { return false }
        let ok = a.invokeMethod("create", withArguments: [PetEngine.json(options)])
        created = ok?.toBool() ?? false
        readFeatures()
        return created
    }

    private func readFeatures() {
        guard let a = api else { return }
        let d = PetEngine.parse(a.invokeMethod("has", withArguments: [])?.toString())
        hasSense = JSRead.flag(d["sense"])
        hasQuality = JSRead.flag(d["quality"])
        hasDen = JSRead.flag(d["den"])
        hasLawn = JSRead.flag(d["lawn"])
        hasPerson = JSRead.flag(d["person"])
        let r = JSRead.int(d["res"])
        baseRes = (r >= 1 && r <= 4) ? r : 2
        configClock = (d["clock"] as? [[String: Any]]) ?? []
        configReunion = d["reunion"] as? String
    }

    var hasEngineScript: Bool {
        guard let a = api else { return false }
        return JSRead.flag(PetEngine.parse(a.invokeMethod("has", withArguments: [])?.toString())["engine"])
    }

    static func json(_ o: Any) -> String {
        guard JSONSerialization.isValidJSONObject(o),
              let d = try? JSONSerialization.data(withJSONObject: o, options: []),
              let s = String(data: d, encoding: .utf8) else { return "{}" }
        return s
    }

    static func parse(_ s: String?) -> [String: Any] {
        guard let text = s, let d = text.data(using: .utf8),
              let o = try? JSONSerialization.jsonObject(with: d, options: []),
              let dict = o as? [String: Any] else { return [:] }
        return dict
    }

    // MARK: 每一帧

    /// 往前走 dt 秒，然后问"这一帧该画什么"。
    func frame(_ dt: Double) -> StageFrame? {
        guard created, let a = api else { return nil }
        guard let v = a.invokeMethod("frame", withArguments: [dt]), v.isArray, let arr = v.toArray() else { return nil }
        frameNo += 1
        var f = StageFrame()
        let n = JSRead.int(JSRead.at(arr, 0))
        let nh = JSRead.int(JSRead.at(arr, 1))
        f.drag = JSRead.double(JSRead.at(arr, 2)) != 0
        if JSRead.double(JSRead.at(arr, 3)) != 0 {
            f.bubbleText = JSRead.string(JSRead.at(arr, 4))
            f.bubbleX = JSRead.double(JSRead.at(arr, 5))
            f.bubbleY = JSRead.double(JSRead.at(arr, 6))
            f.bubbleId = JSRead.int(JSRead.at(arr, 7))
        }
        let h = JSRead.string(JSRead.at(arr, 8))
        if !h.isEmpty { f.home = h }
        f.busy = JSRead.int(JSRead.at(arr, 9))
        f.items = readItems(arr, from: 10, count: n)
        var p = 10 + n * 10
        var i = 0
        while i < nh && p + 3 < arr.count {
            f.hot.append(CGRect(x: JSRead.double(arr[p]), y: JSRead.double(arr[p + 1]),
                                width: JSRead.double(arr[p + 2]), height: JSRead.double(arr[p + 3])))
            p += 4
            i += 1
        }
        // 很久没用到的图不留着
        if frameNo % 900 == 0 && textures.count > 160 {
            let old = frameNo - 900
            textures = textures.filter { $0.value.used >= old }
        }
        return f
    }

    /// 岛上那一小格（它们在岛里睡觉时）
    func den(_ res: Int) -> DenFrame? {
        guard created, hasDen, let a = api else { return nil }
        guard let v = a.invokeMethod("den", withArguments: [res]), v.isArray, let arr = v.toArray() else { return nil }
        var d = DenFrame()
        d.w = JSRead.double(JSRead.at(arr, 0))
        d.h = JSRead.double(JSRead.at(arr, 1))
        d.items = readItems(arr, from: 3, count: JSRead.int(JSRead.at(arr, 2)))
        return d
    }

    /// 一维数组里从 start 开始，每 10 格是一项
    private func readItems(_ a: [Any], from start: Int, count: Int) -> [SpriteItem] {
        var out: [SpriteItem] = []
        if count <= 0 { return out }
        out.reserveCapacity(count)
        var i = 0
        while i < count {
            let p = start + i * 10
            if p + 9 >= a.count { break }
            let key = JSRead.string(a[p + 1])
            let ver = JSRead.int(a[p + 2])
            let pw = JSRead.int(a[p + 3])
            let ph = JSRead.int(a[p + 4])
            var scale = JSRead.double(a[p + 5])
            if scale <= 0 { scale = 1 }
            var item = SpriteItem(id: JSRead.string(a[p]), texKey: key, ver: ver,
                                  x: JSRead.double(a[p + 6]), y: JSRead.double(a[p + 7]),
                                  w: Double(pw) / scale, h: Double(ph) / scale,
                                  flip: JSRead.double(a[p + 8]) != 0, alpha: JSRead.double(a[p + 9]), image: nil)
            item.image = texture(key: key, ver: ver, pw: pw, ph: ph, index: i)
            out.append(item)
            i += 1
        }
        return out
    }

    /// 这张图现成的有就用现成的；没有、或者像素变了，才去把像素拿过来做一张
    private func texture(key: String, ver: Int, pw: Int, ph: Int, index: Int) -> CGImage? {
        if let t = textures[key], t.ver == ver, t.pw == pw, t.ph == ph {
            textures[key]?.used = frameNo
            return t.image
        }
        guard pw > 0, ph > 0, pw <= 8192, ph <= 8192, let a = api,
              let v = a.invokeMethod("data", withArguments: [index]),
              let d = bytes(v, count: pw * ph * 4),
              let img = Pixels.image(d, width: pw, height: ph) else { return nil }
        textures[key] = Texture(image: img, ver: ver, pw: pw, ph: ph, used: frameNo)
        return img
    }

    /// JavaScript 里的一块像素（Uint8ClampedArray）→ 抄出来、预乘好
    private func bytes(_ value: JSValue, count: Int) -> Data? {
        guard count > 0, let ref = value.jsValueRef, let jsctx = context.jsGlobalContextRef else { return nil }
        var exc: JSValueRef? = nil
        guard let obj = JSValueToObject(jsctx, ref, &exc) else { return nil }
        let len = JSObjectGetTypedArrayByteLength(jsctx, obj, &exc)
        let off = JSObjectGetTypedArrayByteOffset(jsctx, obj, &exc)
        guard len >= count, let base = JSObjectGetTypedArrayBytesPtr(jsctx, obj, &exc) else { return nil }
        return Pixels.premultiplied(UnsafeRawPointer(base).advanced(by: off), count)
    }

    // MARK: 其他

    func configure(_ o: [String: Any]) {
        guard created, let a = api else { return }
        a.invokeMethod("configure", withArguments: [PetEngine.json(o)])
    }

    /// 外面的事（鼠标在哪、她多久没碰电脑、屏幕睡了醒了……）。引擎还没有这个功能时什么都不做。
    func sense(_ o: [String: Any]) {
        guard created, hasSense, let a = api else { return }
        a.invokeMethod("sense", withArguments: [PetEngine.json(o)])
    }

    func command(_ name: String) {
        guard created, let a = api else { return }
        a.invokeMethod("command", withArguments: [name])
    }

    /// type: down | move | up | hover | leave；坐标是世界单位。返回 true = 点在球或者谁身上了
    @discardableResult
    func pointer(_ type: String, _ x: Double, _ y: Double) -> Bool {
        guard created, let a = api, x.isFinite, y.isFinite else { return false }
        return a.invokeMethod("pointer", withArguments: [type, x, y])?.toBool() ?? false
    }

    func status() -> EngineStatus {
        guard created, let a = api else { return EngineStatus() }
        return JSRead.status(PetEngine.parse(a.invokeMethod("status", withArguments: [])?.toString()))
    }

    func setQuality(_ q: Double) {
        guard created, hasQuality, let a = api else { return }
        a.invokeMethod("quality", withArguments: [q])
    }

    /// 给自检看的：引擎现在的样子
    func stateJSON() -> String {
        guard created, let a = api else { return "null" }
        return a.invokeMethod("state", withArguments: [])?.toString() ?? "null"
    }

    func extraJSON() -> String {
        guard created, let a = api else { return "{}" }
        return a.invokeMethod("extra", withArguments: [])?.toString() ?? "{}"
    }

    /// 让 lawn.js 画一块草地。返回预乘好的像素、几个像素宽高、一个世界单位几个像素。
    func lawnPixels(w: Double, h: Double, phase: String, res: Int, mode: String) -> (data: Data, width: Int, height: Int, scale: Double)? {
        guard hasLawn, let a = api, w > 0, h > 0 else { return nil }
        guard let info = a.invokeMethod("lawn", withArguments: [w, h, phase, res, mode]), info.isArray,
              let arr = info.toArray() else { return nil }
        let pw = JSRead.int(JSRead.at(arr, 0))
        let ph = JSRead.int(JSRead.at(arr, 1))
        var scale = JSRead.double(JSRead.at(arr, 2))
        if scale <= 0 { scale = Double(res) }
        guard pw > 0, ph > 0, pw <= 16384, ph <= 16384,
              let v = a.invokeMethod("lawnData", withArguments: []),
              let d = bytes(v, count: pw * ph * 4) else { return nil }
        return (d, pw, ph, scale)
    }

    // MARK: 胶水（JavaScript）
    // 引擎那一头的一小段：把外壳的几个函数包成引擎要的 host，把每帧的清单压成一维数组。

    static let shim = #"""
var __qq = (function (G) {
  'use strict';
  var eng = null, last = [], ids = new WeakMap(), nid = 0, lawnImg = null;

  function fin(v, d) { v = +v; return (v === v && v !== Infinity && v !== -Infinity) ? v : d; }
  // 每张图一个名字：有 key 的用 key；没有的（三个角色各自那一张）按"是不是同一个对象"编号
  function keyOf(im) {
    if (im.key) return 'k:' + im.key;
    var n = ids.get(im);
    if (!n) { n = ++nid; ids.set(im, n); }
    return '#' + n;
  }
  // 清单 → 接在 out 后面，每项 10 格：id、图的名字、ver、宽、高、scale、x、y、flip、a
  function flat(out, items) {
    var n = 0;
    last = [];
    for (var i = 0; items && i < items.length; i++) {
      var it = items[i], im = it && it.img;
      if (!im || !im.data || !(im.w > 0) || !(im.h > 0)) continue;
      var s = fin(im.scale, 1);
      last.push(im);
      out.push(String(it.id), keyOf(im), im.key ? 1 : (im.ver | 0), im.w | 0, im.h | 0, s > 0 ? s : 1,
               fin(it.x, 0), fin(it.y, 0), it.flip ? 1 : 0, (it.a === undefined || it.a === null) ? 1 : fin(it.a, 1));
      n++;
    }
    return n;
  }

  // 往前走 dt 秒（一小步最多 1/60 秒），再把这一帧压成：
  //   [几项, 几个可点范围, 在拖吗, 有气泡吗, 气泡的字, 气泡 x, 气泡 y, 气泡编号, home, busy, 清单……, 可点范围……]
  function frame(dt) {
    if (!eng) return null;
    dt = fin(dt, 0);
    if (dt > 0) {
      if (dt > 0.25) dt = 0.25;
      var n = Math.max(1, Math.ceil(dt * 60 - 1e-6));
      for (var i = 0; i < n; i++) eng.step(dt / n);
    }
    var f = eng.compose() || {}, st = eng.status() || {};
    var out = [0, 0, f.drag ? 1 : 0, 0, '', 0, 0, 0, String(st.home || 'out'), eng.busy() | 0];
    out[0] = flat(out, f.items);
    var hot = f.hot || [], nh = 0;
    for (var j = 0; j < hot.length; j++) {
      var h = hot[j];
      if (!h || h.length < 4) continue;
      out.push(fin(h[0], 0), fin(h[1], 0), fin(h[2], 0), fin(h[3], 0));
      nh++;
    }
    out[1] = nh;
    var b = f.bubble;
    if (b && b.text) {
      out[3] = 1; out[4] = String(b.text); out[5] = fin(b.x, 0); out[6] = fin(b.y, 0);
      out[7] = (b.id === undefined || b.id === null) ? 0 : (b.id | 0);
    }
    return out;
  }

  // 岛上那一小格：[宽, 高, 几项, 清单……]
  function den(R) {
    if (!eng || typeof eng.den !== 'function') return null;
    var d = eng.den(R);
    if (!d) return null;
    var out = [fin(d.w, 0), fin(d.h, 0), 0];
    out[2] = flat(out, d.items);
    return out;
  }

  function create(json) {
    var o = JSON.parse(json), cfg = {}, C = G.PET_CONFIG || {}, k;
    for (k in C) cfg[k] = C[k];
    for (k in o) cfg[k] = o[k];
    if (!G.PET_ENGINE || typeof G.PET_ENGINE.create !== 'function') return false;
    var host = {
      now: function () { return G.__qq_now(); },
      storage: {
        get: function (key) { var v = G.__qq_get(String(key)); return (v === undefined || v === null || v === '') ? null : String(v); },
        set: function (key, v) { G.__qq_set(String(key), String(v)); }
      },
      haptic: function (kind) { G.__qq_haptic(String(kind)); },
      island: {
        center: function () { return +G.__qq_islandCenter() || 0; },
        visible: function () { return !!G.__qq_islandVisible(); },
        hit: function (x, y) { return !!G.__qq_islandHit(+x || 0, +y || 0); }
      },
      log: function (msg) { G.__qq_log(String(msg)); }
    };
    eng = G.PET_ENGINE.create(host, cfg);
    return !!eng;
  }

  return {
    create: create,
    frame: frame,
    den: den,
    // 刚才那张清单里第 i 项的像素
    data: function (i) { var im = last[i]; return im ? im.data : null; },
    configure: function (json) { if (eng) eng.configure(JSON.parse(json)); },
    sense: function (json) { if (eng && typeof eng.sense === 'function') eng.sense(JSON.parse(json)); },
    command: function (name) { if (eng) eng.command(String(name)); },
    pointer: function (type, x, y) { return (eng && eng.pointer(String(type), +x || 0, +y || 0)) ? true : false; },
    status: function () { return eng ? JSON.stringify(eng.status() || {}) : '{}'; },
    quality: function (q) { if (eng && typeof eng.setQuality === 'function') eng.setQuality(+q); },
    state: function () {
      if (!eng) return 'null';
      return JSON.stringify((eng._t && typeof eng._t.state === 'function') ? eng._t.state() : eng.status());
    },
    extra: function () {
      var o = {}, t = eng && eng._t;
      if (t && typeof t.perf === 'function') o.rigs = t.perf();
      if (t && typeof t.errors === 'function') o.artErrors = t.errors();
      return JSON.stringify(o);
    },
    // 草地：先画，返回 [宽, 高, scale]；像素另外拿（拿完就放手，不占着内存）
    lawn: function (w, h, phase, R, mode) {
      var L = G.PET_LAWN;
      lawnImg = null;
      if (!L || typeof L.render !== 'function') return null;
      var im = L.render(w, h, String(phase), R, { mode: String(mode) });
      if (!im || !im.data || !(im.w > 0) || !(im.h > 0)) return null;
      lawnImg = im;
      return [im.w | 0, im.h | 0, fin(im.scale, R)];
    },
    lawnData: function () { var d = lawnImg ? lawnImg.data : null; lawnImg = null; return d; },
    has: function () {
      var C = G.PET_CONFIG || {}, r = Math.round(+C.res);
      return JSON.stringify({
        engine: !!(G.PET_ENGINE && typeof G.PET_ENGINE.create === 'function'),
        created: !!eng,
        sense: !!(eng && typeof eng.sense === 'function'),
        quality: !!(eng && typeof eng.setQuality === 'function'),
        den: !!(eng && typeof eng.den === 'function'),
        lawn: !!(G.PET_LAWN && typeof G.PET_LAWN.render === 'function'),
        person: !!(G.PET_PERSON && typeof G.PET_PERSON.create === 'function'),
        fx: !!G.PET_FX,
        dogs: !!G.PET_DOGS,
        res: (r >= 1 && r <= 4) ? r : 2,
        clock: (C.clock && C.clock.length) ? C.clock : null,
        reunion: C.reunion ? String(C.reunion) : null
      });
    },
    // 空转三百万圈：开了"即时编译"十几毫秒就转完，没开要一百多毫秒
    probe: function () { var s = 0; for (var k = 0; k < 3000000; k++) { s = (s + k * 7) % 1000003; } return s; }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
"""#
}
