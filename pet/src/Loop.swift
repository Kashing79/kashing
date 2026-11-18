// 球球 · 节奏：每秒画几帧，什么时候可以歇着
//
//   · 正在动（追球、演戏、有人拖着球）：每秒 30 帧，跟着屏幕的刷新走（系统够新的话），不然就用定时器
//   · 鼠标在附近 / 有蝴蝶：每秒 15 帧；没什么在动：每秒 8 帧左右；都在岛里睡觉：每秒 2 帧
//   · 躲起来了、屏幕睡了 / 锁了、整个被别的东西挡住了：什么都不做，定时器也停掉
// 每一帧：让引擎往前走真实过去的那么多时间 → 问它该画什么 → 把图层摆成那样。
// 另外量一量"走一步 + 问一次"要多少毫秒：太吃力（比如 JavaScript 的"即时编译"没开）就让角色少重画几次。

import Cocoa
import QuartzCore

extension AppDelegate {

    var asleep: Bool { return screensOff || machineAsleep || sessionOff || screenLocked }

    /// 现在该不该动
    func updateActivity() {
        let should = !hiddenByUser && (selfTestPath != nil || (!asleep && !occluded))
        if should == running { return }
        running = should
        if debug { say("ACTIVE \(should ? 1 : 0) hidden=\(hiddenByUser) asleep=\(asleep) occluded=\(occluded)") }
        if should { startLoop() } else { stopLoop() }
    }

    private func startLoop() {
        lastFrameAt = 0
        forceFrame = true
        if timer == nil {
            // 每秒 30 次：看鼠标在哪；没有"跟着屏幕刷新走"的时候也由它来画
            let t = Timer(timeInterval: 1.0 / 30.0, target: self, selector: #selector(tick), userInfo: nil, repeats: true)
            t.tolerance = 0.004
            RunLoop.main.add(t, forMode: .common)
            timer = t
        }
        makeLink()
    }

    private func stopLoop() {
        timer?.invalidate()
        timer = nil
        setLink(false)
        releaseMouse()
    }

    /// 跟着屏幕刷新走的节拍器（macOS 14 起才有；QIUQIU_TIMER=1 可以强制不用它）
    private func makeLink() {
        if displayLink != nil || linkBroken { return }
        if ProcessInfo.processInfo.environment["QIUQIU_TIMER"] == "1" {
            linkBroken = true
            return
        }
        if #available(macOS 14.0, *) {
            let link = stageView.displayLink(target: self, selector: #selector(linkFired(_:)))
            link.preferredFrameRateRange = CAFrameRateRange(minimum: 24, maximum: 30, preferred: 30)
            link.isPaused = true
            link.add(to: RunLoop.main, forMode: RunLoop.Mode.common)
            displayLink = link
        }
    }

    private func setLink(_ on: Bool) {
        let want = on && running && !linkBroken
        if #available(macOS 14.0, *) {
            guard let link = displayLink as? CADisplayLink else {
                linkOn = false
                return
            }
            if link.isPaused == want { link.isPaused = !want }
            linkOn = want
        } else {
            linkOn = false
        }
    }

    @objc func linkFired(_ sender: AnyObject) {
        if !running || !linkOn { return }
        linkMisses = 0
        frameIfDue(CACurrentMediaTime())
    }

    @objc func tick() {
        let now = CACurrentMediaTime()
        tickCount += 1
        if tickCount % 60 == 0 { applyGeometry(force: false) }     // 程序坞变大变小、换了分辨率之类
        pollMouse(now)
        feedSenses(now)
        if linkOn && !forceFrame {
            if now - lastFrameAt < 0.12 { return }
            // 节拍器该来没来（这种屏幕上可能不灵）：这一帧由定时器画；老是不来就不用它了
            linkMisses += 1
            if linkMisses > 6 {
                linkBroken = true
                setLink(false)
                if debug { say("LINK off (no callbacks): using the timer") }
            }
        }
        frameIfDue(now)
    }

    /// 她刚点了一下 / 按了按钮：别等慢的那一拍，马上画
    func kick() {
        forceFrame = true
        statusAt = 0
        if running && engine != nil { frameIfDue(CACurrentMediaTime()) }
    }

    func frameIfDue(_ now: CFTimeInterval) {
        if !running { return }
        var interval = 1.0 / 8.0
        if busy >= 2 {
            interval = 1.0 / 30.0
        } else if busy == 1 {
            interval = 1.0 / 15.0
        } else if home == "in" {
            interval = 0.5
        }
        if !forceFrame && lastFrameAt > 0 && now - lastFrameAt < interval - 0.006 { return }
        forceFrame = false
        runFrame(now)
    }

    func runFrame(_ now: CFTimeInterval) {
        guard let eng = engine else { return }
        var dt: Double = lastFrameAt > 0 ? now - lastFrameAt : 1.0 / 60.0
        if dt < 0 { dt = 0 }
        if dt > 0.25 { dt = 0.25 }          // 隔了太久（刚睡醒）就不追了
        lastFrameAt = now

        let t0 = CACurrentMediaTime()
        guard let fr = eng.frame(dt) else { return }
        notePerf((CACurrentMediaTime() - t0) * 1000.0, busy: fr.busy)

        busy = fr.busy
        home = fr.home
        lastItemCount = fr.items.count
        if fr.drag != jsDragging {
            jsDragging = fr.drag
            if debug { say("JSDRAG \(fr.drag ? 1 : 0)") }
        }
        // 可以点的范围：世界单位 → 面板里的 pt
        var rects: [CGRect] = []
        rects.reserveCapacity(fr.hot.count)
        for r in fr.hot {
            rects.append(CGRect(x: r.minX * unit, y: offTop + r.minY * unit, width: r.width * unit, height: r.height * unit))
        }
        petHot = rects

        CATransaction.begin()
        CATransaction.setDisableActions(true)
        // 草地上的印记：有草地就画在草地上（她的窗口后面）；没有草地时只画允许画在最上面那层的几个，垫在最底下
        if lawn.shownMode != "off" {
            lawn.applyDecals(fr.decals, unit: unit, backing: geo.backing, originTop: offTop)
            sprites.apply(fr.items, unit: unit, backing: geo.backing, originX: 0, originTop: offTop)
        } else {
            lawn.applyDecals([], unit: unit, backing: geo.backing, originTop: offTop)
            sprites.apply(fr.overlayDecals.isEmpty ? fr.items : fr.overlayDecals + fr.items,
                          unit: unit, backing: geo.backing, originX: 0, originTop: offTop)
        }
        bubble.update(text: fr.bubbleText, key: "\(fr.bubbleId)|" + (fr.bubbleText ?? ""),
                      anchorX: CGFloat(fr.bubbleX) * unit, anchorTop: offTop + CGFloat(fr.bubbleY) * unit,
                      viewSize: geo.frame.size, backing: geo.backing)
        if now - statusAt > 0.5 || home != status.home { refreshStatus(now) }
        // 它们在岛里（或者正在回岛）：把睡着的样子画进岛上那一小格
        if island.showsDen {
            if let d = eng.den(2) { island.drawDen(d) }
        } else {
            island.clearDen()
        }
        CATransaction.commit()

        setLink(busy >= 2)
    }

    /// 隔一会儿问一次引擎"现在什么样"：岛上的数字、草地的颜色都跟着它
    func refreshStatus(_ now: CFTimeInterval) {
        guard let eng = engine else { return }
        statusAt = now
        status = eng.status()
        island.update(status)
        // 草地跟着时间换颜色。重画要花一点时间，所以等它们闲下来再换，最多等两分钟。
        let phase = currentPhase()
        if phase != lawnPhase {
            if lawnPhaseSince == 0 { lawnPhaseSince = now }
            if busy == 0 || now - lawnPhaseSince > 120 {
                lawnPhase = phase
                lawnPhaseSince = 0
                refreshLawn()
            }
        } else {
            lawnPhaseSince = 0
        }
    }

    /// 记下这一帧花了多少毫秒；吃力的话让角色少重画几次
    private func notePerf(_ ms: Double, busy b: Int) {
        if perfWarmup > 0 {         // 头几帧要建图、热身，不算
            perfWarmup -= 1
            return
        }
        perfAllSum += ms
        perfAllN += 1
        if b < 2 { return }
        perfSum += ms
        perfN += 1
        let window = perfFirstDone ? 300 : 90
        if perfN < window { return }
        let avg = perfSum / Double(perfN)
        perfSum = 0
        perfN = 0
        perfBusyAvg = avg
        var q = quality
        if avg > 3.0 {
            // 头一回按比例降，以后每回再降一点
            q = perfFirstDone ? q * 0.75 : min(q, 3.0 / avg)
            if q < 0.25 { q = 0.25 }
        }
        perfFirstDone = true
        if debug { say("PERF msPerFrame \(String(format: "%.2f", avg)) (busy frames) quality \(String(format: "%.2f", q))") }
        if q != quality {
            quality = q
            engine?.setQuality(q)
        }
    }

    /// 自检和调试用：到现在为止平均一帧多少毫秒
    func perfSummary() -> String {
        let all = perfAllN > 0 ? perfAllSum / Double(perfAllN) : 0
        let busyAvg = perfN > 0 ? perfSum / Double(perfN) : perfBusyAvg
        return "\(String(format: "%.3f", all)) frames=\(perfAllN) busy=\(String(format: "%.3f", busyAvg)) quality=\(String(format: "%.2f", quality))"
    }
}
