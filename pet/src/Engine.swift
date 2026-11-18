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
    var islandRim: () -> String = { return "" }             // "x0,x1,y"：岛下沿（世界单位）；没有岛就是空的
    var islandPulse: (String) -> Void = { _ in }            // 剧本让岛动一下

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
        let clock: @convention(block) () -> Double = {
            return CACurrentMediaTime()
        }
        // "今天丢了几次球"这些小数据，存在系统给每个 App 的设定里
        let readStore: @convention(block) (String) -> String = { key in
            return UserDefaults.standard.string(forKey: "js." + key) ?? ""
        }
        let writeStore: @convention(block) (String, String) -> Void = { key, value in
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
        let rim: @convention(block) () -> String = { [weak self] in
            guard let s = self else { return "" }
            return s.islandRim()
        }
        let pulse: @convention(block) (String) -> Void = { [weak self] kind in
            guard let s = self else { return }
            s.islandPulse(kind)
        }
        let logLine: @convention(block) (String) -> Void = { [weak self] msg in
            guard let s = self else { return }
            if s.verbose { say("JS LOG " + msg) }
        }
        context.setObject(unsafeBitCast(clock, to: AnyObject.self), forKeyedSubscript: "__qq_now" as NSString)
        context.setObject(unsafeBitCast(readStore, to: AnyObject.self), forKeyedSubscript: "__qq_get" as NSString)
        context.setObject(unsafeBitCast(writeStore, to: AnyObject.self), forKeyedSubscript: "__qq_set" as NSString)
        context.setObject(unsafeBitCast(haptic, to: AnyObject.self), forKeyedSubscript: "__qq_haptic" as NSString)
        context.setObject(unsafeBitCast(center, to: AnyObject.self), forKeyedSubscript: "__qq_islandCenter" as NSString)
        context.setObject(unsafeBitCast(visible, to: AnyObject.self), forKeyedSubscript: "__qq_islandVisible" as NSString)
        context.setObject(unsafeBitCast(hit, to: AnyObject.self), forKeyedSubscript: "__qq_islandHit" as NSString)
        context.setObject(unsafeBitCast(rim, to: AnyObject.self), forKeyedSubscript: "__qq_islandRim" as NSString)
        context.setObject(unsafeBitCast(pulse, to: AnyObject.self), forKeyedSubscript: "__qq_islandPulse" as NSString)
        context.setObject(unsafeBitCast(logLine, to: AnyObject.self), forKeyedSubscript: "__qq_log" as NSString)
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
        let names = ["config.js", "sprites.js", "fx.js", "dogs.js", "person.js", "lawn.js", "needs.js", "pet.js"]
        for name in names {
            if evaluateFile(dir.appendingPathComponent(name)) { loaded.append(name) }
        }
        // "小剧场剧本"：scenes/ 里的每个 .js，按文件名排好一个个读（每个往 PET_SCENES 里加几场戏）
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
        f.items = readItems(arr, from: 10, count: n, base: 0)
        var p = 10 + n * PetEngine.stride
        var i = 0
        while i < nh && p + 3 < arr.count {
            f.hot.append(CGRect(x: JSRead.double(arr[p]), y: JSRead.double(arr[p + 1]),
                                width: JSRead.double(arr[p + 2]), height: JSRead.double(arr[p + 3])))
            p += 4
            i += 1
        }
        // 草地上的印记：先是全部，再是没有草地时要画在最上面那层的几个（像素按顺序排在清单后面）
        if p < arr.count {
            let nd = JSRead.int(arr[p])
            f.decals = readItems(arr, from: p + 1, count: nd, base: n)
            p += 1 + max(0, nd) * PetEngine.stride
            if p < arr.count {
                let no = JSRead.int(arr[p])
                f.overlayDecals = readItems(arr, from: p + 1, count: no, base: n + max(0, nd))
            }
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
        d.items = readItems(arr, from: 3, count: JSRead.int(JSRead.at(arr, 2)), base: 0)
        return d
    }

    /// 清单里每一项在一维数组里占几格（和 Glue.swift 里的 flat() 对上）
    static let stride = 15

    /// 一维数组里从 start 开始，每 stride 格是一项；base = 这张清单的第一张图在"这一帧所有图"里排第几
    private func readItems(_ a: [Any], from start: Int, count: Int, base: Int) -> [SpriteItem] {
        var out: [SpriteItem] = []
        if count <= 0 { return out }
        out.reserveCapacity(count)
        var i = 0
        while i < count {
            let p = start + i * PetEngine.stride
            if p + PetEngine.stride - 1 >= a.count { break }
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
            if JSRead.double(a[p + 10]) != 0 {
                item.clip = CGRect(x: JSRead.double(a[p + 11]), y: JSRead.double(a[p + 12]),
                                   width: JSRead.double(a[p + 13]), height: JSRead.double(a[p + 14]))
            }
            item.image = texture(key: key, ver: ver, pw: pw, ph: ph, index: base + i)
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
}
