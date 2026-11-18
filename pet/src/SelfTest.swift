// 球球 · 自检（安装完可以跑： QiuQiu --selftest /tmp/qiuqiu.png ）
//
// 启动 3 秒后：把画面上所有图层画进一张位图（不是截屏，不需要任何权限），存成 PNG，然后数一数——
//   · 岛下面有没有画出东西（小人和狗狗）：只画出了岛不算通过
//   · 背景是不是透明的
// 顺便打印引擎现在的样子、画一帧要多少毫秒、JavaScript 跑得快不快、草地多大。
// 最后一行是 SELFTEST PASS 或 SELFTEST FAIL …（测试脚本靠这一行判断）。

import Cocoa
import QuartzCore

extension AppDelegate {

    @objc func runSelfTest(_ path: String) {
        // 不管现在几点、它们在不在岛里，先保证最新的一帧已经摆到图层上了
        runFrame(CACurrentMediaTime())
        CATransaction.flush()

        say("SELFTEST render native")
        say("SELFTEST loaded \(engine?.loaded.joined(separator: " ") ?? "nothing")")
        say("SELFTEST state \(engine?.stateJSON() ?? "null")")
        say("SELFTEST extra \(engine?.extraJSON() ?? "{}")")
        say("SELFTEST msPerFrame \(perfSummary())")
        say("SELFTEST jit \(jitFast ? "fast" : "slow") loopMs=\(String(format: "%.1f", jitMs))")
        say("SELFTEST lawn \(lawn.shownMode) \(lawn.pixelW)x\(lawn.pixelH) ms=\(String(format: "%.0f", lawn.lastMs)) window=\(lawn.windowNumber)")
        say("SELFTEST scale unit=\(unit) res=\(res) backing=\(geo.backing) view=\(Int(viewW))x\(Int(viewH)) notch=\(Int(geo.notchW)) bar=\(Int(geo.barH))")
        say("SELFTEST layers \(sprites.count) items \(lastItemCount) hotRects \(allHot().count) panel \(Int(panel.frame.width))x\(Int(panel.frame.height)) visible \(panel.isVisible) level \(panel.level.rawValue)")
        let exceptions = engine?.exceptionCount ?? 0
        say("SELFTEST jsExceptions \(exceptions)")

        guard let root = stageView.layer else {
            say("SELFTEST FAIL no layer")
            exit(1)
        }
        // 一个屏幕像素对一个位图像素
        let scale: CGFloat = geo.backing > 0 ? geo.backing : 1
        let pw = Int((stageView.bounds.width * scale).rounded())
        let ph = Int((stageView.bounds.height * scale).rounded())
        guard pw > 0, ph > 0,
              let ctx = CGContext(data: nil, width: pw, height: ph, bitsPerComponent: 8, bytesPerRow: 0,
                                  space: CGColorSpaceCreateDeviceRGB(),
                                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else {
            say("SELFTEST FAIL bitmap \(pw)x\(ph)")
            exit(1)
        }
        ctx.clear(CGRect(x: 0, y: 0, width: pw, height: ph))
        ctx.interpolationQuality = .none
        ctx.scaleBy(x: scale, y: scale)
        root.render(in: ctx)

        if let image = ctx.makeImage() {
            let rep = NSBitmapImageRep(cgImage: image)
            if let png = rep.representation(using: .png, properties: [:]) {
                try? png.write(to: URL(fileURLWithPath: path))
            }
        }

        guard let buffer = ctx.data else {
            say("SELFTEST FAIL no pixels")
            exit(1)
        }
        let rowBytes = ctx.bytesPerRow
        let p = buffer.bindMemory(to: UInt8.self, capacity: rowBytes * ph)
        // 顶上那一条是岛；小人和狗狗在它下面。两块分开数，免得"只画出了岛"也算通过。
        let barRows = Int(70 * scale)
        var drawn = 0, clear = 0, total = 0, pets = 0
        var y = 0
        while y < ph {
            var x = 0
            let row = y * rowBytes
            while x < pw {
                let a = p[row + x * 4 + 3]
                total += 1
                if a > 127 {
                    drawn += 1
                    if y > barRows { pets += 1 }
                } else if a < 5 {
                    clear += 1
                }
                x += 3
            }
            y += 3
        }
        let cornerA = Int(p[2 * rowBytes + 2 * 4 + 3])
        let cornerB = Int(p[2 * rowBytes + max(0, pw - 3) * 4 + 3])
        say("SELFTEST snapshot \(pw)x\(ph) drawn=\(drawn) pets=\(pets) clear=\(clear) total=\(total) cornerAlpha=\(cornerA),\(cornerB)")

        let transparent = cornerA < 5 && cornerB < 5 && clear > total / 2
        let hasPets = pets > 40
        let cleanJS = exceptions == 0
        if transparent && hasPets && cleanJS {
            say("SELFTEST PASS")
            exit(0)
        }
        say("SELFTEST FAIL transparent=\(transparent) hasPets=\(hasPets) jsExceptions=\(exceptions)")
        exit(1)
    }
}
