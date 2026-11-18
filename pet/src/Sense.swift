// 球球 · 外面的事
//
// 引擎想知道屏幕外面发生了什么，好让它们有反应（她回来了会迎上去之类）。这些都不需要任何系统权限：
//   · 鼠标在它们这块屏幕的哪里（一秒最多说十次，动了才说）
//   · 她多久没碰键盘和鼠标了（只知道"多久"，不知道按了什么）
//   · 屏幕睡了 / 醒了、锁了 / 解锁了、切换了登录的人
//   · 电量（笔记本才有）
//   · 最前面是哪个 App：默认不说，她在菜单里打开才说
// 引擎还没有这个功能（没有 sense）的时候，这里什么都不会发给它。
// 屏幕睡了、锁了、整个窗口被挡住的时候，画面那边也会跟着停下来。

import Cocoa
import IOKit.ps

/// 电量：只读一下系统给的数字
enum Battery {
    /// 电量（0 到 1）和是不是插着电。没有电池（台式机）就是 nil。
    static func read() -> (level: Double, charging: Bool)? {
        guard let infoRef = IOPSCopyPowerSourcesInfo() else { return nil }
        let info = infoRef.takeRetainedValue()
        guard let listRef = IOPSCopyPowerSourcesList(info) else { return nil }
        let list = listRef.takeRetainedValue() as [CFTypeRef]
        for ps in list {
            guard let descRef = IOPSGetPowerSourceDescription(info, ps) else { continue }
            guard let d = descRef.takeUnretainedValue() as? [String: Any] else { continue }
            if let type = d["Type"] as? String, type != "InternalBattery" { continue }
            guard let now = d["Current Capacity"] as? Int, let full = d["Max Capacity"] as? Int, full > 0 else { continue }
            let level = min(1.0, max(0.0, Double(now) / Double(full)))
            let charging = (d["Is Charging"] as? Bool) ?? false
            let plugged = (d["Power Source State"] as? String) == "AC Power"
            return (level, charging || plugged)
        }
        return nil
    }
}

extension AppDelegate {

    func startSensing() {
        let ws = NSWorkspace.shared.notificationCenter
        let names: [NSNotification.Name] = [
            NSWorkspace.screensDidSleepNotification, NSWorkspace.screensDidWakeNotification,
            NSWorkspace.willSleepNotification, NSWorkspace.didWakeNotification,
            NSWorkspace.sessionDidResignActiveNotification, NSWorkspace.sessionDidBecomeActiveNotification,
        ]
        for name in names {
            ws.addObserver(self, selector: #selector(worldChanged(_:)), name: name, object: nil)
        }
        ws.addObserver(self, selector: #selector(frontAppChanged), name: NSWorkspace.didActivateApplicationNotification, object: nil)
        ws.addObserver(self, selector: #selector(recheckOcclusion), name: NSWorkspace.activeSpaceDidChangeNotification, object: nil)
        // 锁屏 / 解锁
        let dn = DistributedNotificationCenter.default()
        dn.addObserver(self, selector: #selector(worldChanged(_:)), name: NSNotification.Name("com.apple.screenIsLocked"), object: nil)
        dn.addObserver(self, selector: #selector(worldChanged(_:)), name: NSNotification.Name("com.apple.screenIsUnlocked"), object: nil)
        // 整个窗口被挡住（比如切到了全屏的 App）
        NotificationCenter.default.addObserver(self, selector: #selector(occlusionChanged),
                                               name: NSWindow.didChangeOcclusionStateNotification, object: panel)
        if debug { say("SENSE engine=\(engine?.hasSense ?? false) battery=\(Battery.read() != nil)") }
        tellFrontApp()
    }

    /// 屏幕睡了 / 醒了、锁了 / 解锁了、换了登录的人
    @objc func worldChanged(_ note: Notification) {
        let was = asleep
        switch note.name {
        case NSWorkspace.screensDidSleepNotification: screensOff = true
        case NSWorkspace.screensDidWakeNotification: screensOff = false
        case NSWorkspace.willSleepNotification: machineAsleep = true
        case NSWorkspace.didWakeNotification: machineAsleep = false
        case NSWorkspace.sessionDidResignActiveNotification: sessionOff = true
        case NSWorkspace.sessionDidBecomeActiveNotification: sessionOff = false
        case NSNotification.Name("com.apple.screenIsLocked"): screenLocked = true
        case NSNotification.Name("com.apple.screenIsUnlocked"): screenLocked = false
        default: break
        }
        if asleep == was { return }
        tellAsleep(woke: was && !asleep)
        if !asleep { batteryAt = 0 }
        updateActivity()
    }

    /// 告诉引擎"现在没人看"（屏幕睡了、锁了，或者她让它们先躲起来了）；醒来时顺便说一声"她回来了"
    func tellAsleep(woke: Bool) {
        let off = asleep || hiddenByUser
        if off == toldAsleep { return }
        toldAsleep = off
        if off {
            engine?.sense(["asleep": true])
        } else if woke {
            engine?.sense(["asleep": false, "woke": true])
        } else {
            engine?.sense(["asleep": false])
        }
    }

    @objc func occlusionChanged() {
        if hiddenByUser { return }
        if panel.occlusionState.contains(.visible) {
            if occluded {
                occluded = false
                updateActivity()
            }
        } else {
            // 等一下再确认一次，免得切换桌面的那一瞬间误判
            NSObject.cancelPreviousPerformRequests(withTarget: self, selector: #selector(recheckOcclusion), object: nil)
            perform(#selector(recheckOcclusion), with: nil, afterDelay: 1.0)
        }
    }

    @objc func recheckOcclusion() {
        if hiddenByUser { return }
        if ProcessInfo.processInfo.environment["QIUQIU_IGNORE_OCCLUSION"] == "1" { return }     // 调试用
        let hidden = !panel.occlusionState.contains(.visible)
        if hidden != occluded {
            occluded = hidden
            updateActivity()
        }
    }

    // MARK: 每秒 30 次里顺带做的

    func feedSenses(_ now: CFTimeInterval) {
        guard let eng = engine, eng.hasSense else { return }
        var o: [String: Any] = [:]
        // 鼠标：一秒最多说十次，动了才说；跑到别的屏幕上去了就说一声"不知道在哪"
        if now - cursorSentAt >= 0.1 {
            if cursorOn {
                if !cursorTold || abs(cursor.x - cursorSent.x) > 0.5 || abs(cursor.y - cursorSent.y) > 0.5 {
                    let w = toWorld(cursor)
                    o["cursor"] = [w.x, w.y]
                    cursorSent = cursor
                    cursorTold = true
                    cursorSentAt = now
                }
            } else if cursorTold {
                o["cursor"] = NSNull()
                cursorTold = false
                cursorSentAt = now
            }
        }
        // 她多久没碰电脑了：一秒说一次；她刚回来（鼠标动了）就马上说
        if now - idleSentAt >= 1.0 || (!o.isEmpty && idleTold > 2) {
            let idle = idleSeconds()
            o["idle"] = idle
            idleTold = idle
            idleSentAt = now
        }
        // 电量：一分钟看一次，变了才说
        if now - batteryAt >= 60 || batteryAt == 0 {
            batteryAt = now
            var text = "none"
            var value: Any = NSNull()
            if let b = Battery.read() {
                let level = (b.level * 100).rounded() / 100
                text = "\(level)/\(b.charging)"
                value = ["level": level, "charging": b.charging] as [String: Any]
            }
            if text != batteryTold {
                batteryTold = text
                o["battery"] = value
            }
        }
        // 程序坞和菜单栏上的 🎾 在哪：两秒看一次，变了才说
        if now - placesAt >= 2.0 {
            placesAt = now
            let p = places()
            if p.text != placesTold {
                placesTold = p.text
                o["dock"] = p.dock
                o["statusItem"] = p.item
            }
        }
        if !o.isEmpty { eng.sense(o) }
    }

    /// 程序坞（只认放在屏幕底下、没有自动隐藏的）和 🎾 的位置，都换成世界单位。
    /// 程序坞具体多宽系统不告诉我们（要权限才行），就按屏幕宽度的一半估；剧本只用它中间那一段。
    func places() -> (dock: Any, item: Any, text: String) {
        var dock: Any = NSNull()
        var item: Any = NSNull()
        var text = "dock:none"
        if unit > 0 && geo.bottom >= 8 {
            let h = Double(geo.bottom / unit)
            let w = (viewW * 0.5).rounded()
            let x = ((viewW - w) / 2).rounded()
            dock = ["x": x, "y": viewH - h, "w": w, "h": h] as [String: Any]
            text = "dock:\(x),\(w),\(h)"
        }
        if unit > 0, let win = statusItem?.button?.window {
            let f = win.frame
            let pf = geo.frame
            if f.width > 0 && f.midX >= pf.minX && f.midX <= pf.maxX && abs(f.maxY - pf.maxY) < 60 {
                let x = (Double((f.midX - pf.minX) / unit) * 10).rounded() / 10
                item = x
                text += " item:\(x)"
            }
        }
        return (dock, item, text)
    }

    /// 距离她上一次动键盘或鼠标过了几秒（系统只告诉我们"多久"，这不需要任何权限）
    func idleSeconds() -> Double {
        guard let anyInput = CGEventType(rawValue: UInt32.max) else { return 0 }
        let s = CGEventSource.secondsSinceLastEventType(.combinedSessionState, eventType: anyInput)
        if !s.isFinite || s < 0 { return 0 }
        return (s * 10).rounded() / 10
    }

    // MARK: 最前面的 App（她打开了那个选项才说）

    @objc func frontAppChanged() { tellFrontApp() }

    func tellFrontApp() {
        guard let eng = engine, eng.hasSense else { return }
        if defaults.bool(forKey: "frontApp") {
            if let id = NSWorkspace.shared.frontmostApplication?.bundleIdentifier {
                eng.sense(["frontApp": id])
            } else {
                eng.sense(["frontApp": NSNull()])
            }
        } else {
            eng.sense(["frontApp": NSNull()])
        }
    }
}
