// 球球 · 菜单栏的 🎾 和它的菜单（在小人或小狗身上点右键也是同一个菜单）
// 还有：三种语言的文字、开机自动启动。

import Cocoa

// MARK: - 文字（跟着系统语言走：繁体 / 简体 / 英文）

enum L10n {
    enum Lang { case hant, hans, en }

    static let lang: Lang = {
        let pref = (Locale.preferredLanguages.first ?? "en").lowercased()
        if pref.hasPrefix("zh") {
            if pref.contains("hant") || pref.contains("-tw") || pref.contains("-hk") || pref.contains("-mo") {
                return .hant
            }
            return .hans
        }
        return .en
    }()

    static func t(_ hant: String, _ hans: String, _ en: String) -> String {
        switch lang {
        case .hant: return hant
        case .hans: return hans
        case .en: return en
        }
    }
}

let kBundleID = "local.qiuqiu.deskpet"

// MARK: - 菜单

extension AppDelegate: NSMenuDelegate {

    func buildMenu() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        statusItem.button?.title = "🎾"
        statusItem.button?.toolTip = L10n.t("球球", "球球", "QiuQiu")
        menu = NSMenu()
        menu.autoenablesItems = false
        menu.delegate = self
        statusItem.menu = menu
        rebuildMenu()
    }

    func menuNeedsUpdate(_ menu: NSMenu) { rebuildMenu() }

    @discardableResult
    private func addItem(_ title: String, _ action: Selector, to m: NSMenu) -> NSMenuItem {
        let item = NSMenuItem(title: title, action: action, keyEquivalent: "")
        item.target = self
        m.addItem(item)
        return item
    }

    func rebuildMenu() {
        menu.removeAllItems()
        // 菜单上的字和勾要跟引擎现在的样子一致
        if let eng = engine { status = eng.status() }
        let care = status.care                      // 引擎有"喂饭、便便"那一套才有这几项
        let outside = status.home == "out" || status.home == "leaving"

        addItem(L10n.t("丟球球！", "丢球球！", "Throw the ball!"), #selector(throwBall), to: menu)
        if care != nil {
            let feed = addItem(L10n.t("開飯囉！", "开饭啦！", "Feed them now"), #selector(feedNow), to: menu)
            feed.isEnabled = !hiddenByUser
        }
        addItem(L10n.t("打個招呼", "打个招呼", "Say hi"), #selector(sayHi), to: menu)
        addItem(outside ? L10n.t("回島睡覺", "回岛睡觉", "Nap at home") : L10n.t("出來玩", "出来玩", "Come out"),
                #selector(toggleHome), to: menu)
        menu.addItem(NSMenuItem.separator())

        let auto = addItem(L10n.t("小人自動丟球", "小人自动丢球", "Auto-play"), #selector(toggleAuto), to: menu)
        auto.state = defaults.bool(forKey: "auto") ? .on : .off
        if let c = care {
            let feeding = addItem(L10n.t("小人自動餵飯", "小人自动喂饭", "Auto-feeding"), #selector(toggleFeeding), to: menu)
            feeding.state = c.feeding ? .on : .off
            let potty = addItem(L10n.t("狗狗會便便（小人會清）", "狗狗会拉粑粑（小人会收拾）", "Potty breaks (he cleans up)"),
                                #selector(togglePotty), to: menu)
            potty.state = c.potty ? .on : .off
        }
        let roam = addItem(L10n.t("滿螢幕到處跑", "满屏幕到处跑", "Roam the whole screen"), #selector(toggleRoam), to: menu)
        roam.state = defaults.bool(forKey: "roam") ? .on : .off
        let isl = addItem(L10n.t("顯示靈動島", "显示灵动岛", "Show the island"), #selector(toggleIsland), to: menu)
        isl.state = defaults.bool(forKey: "island") ? .on : .off

        // 桌面上的草地（有 lawn.js 才有这一项）
        if let eng = engine, eng.hasLawn {
            let lawnItem = NSMenuItem(title: L10n.t("桌面草地", "桌面草地", "Lawn on the desktop"), action: nil, keyEquivalent: "")
            let lawnMenu = NSMenu()
            let now = lawnMode()
            let kinds: [(String, String)] = [
                (L10n.t("整個桌面", "整个桌面", "Whole desktop"), "full"),
                (L10n.t("只在底部一條", "只在底部一条", "A strip along the bottom"), "strip"),
                (L10n.t("不要草地", "不要草地", "Off"), "off"),
            ]
            for entry in kinds {
                let item = addItem(entry.0, #selector(setLawn(_:)), to: lawnMenu)
                item.representedObject = entry.1
                item.state = (now == entry.1) ? .on : .off
            }
            lawnItem.submenu = lawnMenu
            menu.addItem(lawnItem)
        }

        let sizeItem = NSMenuItem(title: L10n.t("大小", "大小", "Size"), action: nil, keyEquivalent: "")
        let sizeMenu = NSMenu()
        let current = defaults.integer(forKey: "scale")
        let sizes: [(String, Int)] = [
            (L10n.t("小", "小", "Small"), 2),
            (L10n.t("中", "中", "Medium"), 3),
            (L10n.t("大", "大", "Large"), 4),
        ]
        for entry in sizes {
            let item = addItem(entry.0, #selector(setSize(_:)), to: sizeMenu)
            item.tag = entry.1
            item.state = (current == entry.1) ? .on : .off
        }
        sizeItem.submenu = sizeMenu
        menu.addItem(sizeItem)

        // 让它们知道她正在用哪个 App（默认关；引擎有这个功能才出现）
        if let eng = engine, eng.hasSense {
            let front = addItem(L10n.t("留意妳正在用哪個 App", "留意你正在用哪个 App", "Notice which app you're using"),
                                #selector(toggleFrontApp), to: menu)
            front.state = defaults.bool(forKey: "frontApp") ? .on : .off
        }

        if NSScreen.screens.count > 1 {
            addItem(L10n.t("換到另一個螢幕", "换到另一个屏幕", "Move to next display"), #selector(nextScreen), to: menu)
        }

        let login = addItem(L10n.t("開機自動啟動", "开机自动启动", "Launch at login"), #selector(toggleLogin), to: menu)
        login.state = loginEnabled() ? .on : .off

        menu.addItem(NSMenuItem.separator())
        addItem(hiddenByUser ? L10n.t("出來玩", "出来玩", "Show") : L10n.t("先躲起來", "先躲起来", "Hide"),
                #selector(toggleHidden), to: menu)
        addItem(L10n.t("結束", "退出", "Quit"), #selector(quit), to: menu)
    }

    func popUpMenu(with event: NSEvent) {
        rebuildMenu()
        NSMenu.popUpContextMenu(menu, with: event, for: stageView)
    }

    // MARK: 菜单里的每一项

    @objc func throwBall() {
        if hiddenByUser { toggleHidden() }
        engine?.command("throw")
        kick()
    }

    @objc func feedNow() {
        if hiddenByUser { return }
        engine?.command("feed")
        kick()
    }

    @objc func sayHi() {
        if hiddenByUser { toggleHidden() }
        engine?.command("wave")
        kick()
    }

    @objc func toggleHome() {
        if hiddenByUser { toggleHidden() }
        engine?.command("toggleHome")
        kick()
    }

    @objc func toggleAuto() {
        let on = !defaults.bool(forKey: "auto")
        defaults.set(on, forKey: "auto")
        engine?.configure(["auto": on])
    }

    @objc func toggleFeeding() {
        let on = !(status.care?.feeding ?? true)
        defaults.set(on, forKey: "feeding")
        engine?.configure(["feeding": on])
        kick()
    }

    @objc func togglePotty() {
        let on = !(status.care?.potty ?? true)
        defaults.set(on, forKey: "potty")
        engine?.configure(["potty": on])
        kick()
    }

    @objc func toggleRoam() {
        let on = !defaults.bool(forKey: "roam")
        defaults.set(on, forKey: "roam")
        engine?.configure(["roam": on, "grass": grassOn(engine)])
        kick()
    }

    @objc func toggleIsland() {
        let on = !defaults.bool(forKey: "island")
        defaults.set(on, forKey: "island")
        island.setEnabled(on)
        kick()
    }

    @objc func setLawn(_ sender: NSMenuItem) {
        guard let mode = sender.representedObject as? String else { return }
        defaults.set(mode, forKey: "lawn")
        engine?.configure(["grass": grassOn(engine)])
        refreshLawn()
        kick()
    }

    @objc func setSize(_ sender: NSMenuItem) {
        defaults.set(sender.tag, forKey: "scale")
        applyGeometry(force: false)
    }

    @objc func toggleFrontApp() {
        let on = !defaults.bool(forKey: "frontApp")
        defaults.set(on, forKey: "frontApp")
        tellFrontApp()
    }

    @objc func nextScreen() {
        let n = NSScreen.screens.count
        if n == 0 { return }
        defaults.set((defaults.integer(forKey: "screen") + 1) % n, forKey: "screen")
        applyGeometry(force: false)
    }

    @objc func toggleHidden() {
        hiddenByUser = !hiddenByUser
        if hiddenByUser {
            releaseMouse()
            panel.orderOut(nil)
        } else {
            occluded = false
            applyGeometry(force: false)
            panel.orderFrontRegardless()
        }
        refreshLawn()               // 草地跟着一起躲起来 / 出来
        tellAsleep(woke: false)
        updateActivity()
    }

    @objc func quit() { NSApp.terminate(nil) }

    // MARK: 开机自动启动（在 ~/Library/LaunchAgents 放一个小文件，关掉就是把它删了）

    private var agentURL: URL {
        return FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/LaunchAgents/\(kBundleID).plist")
    }

    private func loginEnabled() -> Bool {
        return FileManager.default.fileExists(atPath: agentURL.path)
    }

    @objc func toggleLogin() {
        let fm = FileManager.default
        if loginEnabled() {
            try? fm.removeItem(at: agentURL)
            return
        }
        guard let exe = Bundle.main.executablePath else { return }
        let plist: [String: Any] = [
            "Label": kBundleID,
            "ProgramArguments": [exe],
            "RunAtLoad": true,
            "ProcessType": "Interactive",
            "LimitLoadToSessionType": "Aqua",
        ]
        try? fm.createDirectory(at: agentURL.deletingLastPathComponent(), withIntermediateDirectories: true, attributes: nil)
        if let data = try? PropertyListSerialization.data(fromPropertyList: plist, format: .xml, options: 0) {
            try? data.write(to: agentURL)
        }
    }
}
