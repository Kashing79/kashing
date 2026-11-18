// 球球 · 岛的零件：按钮、弹开后那一块怎么摆、轮廓和弹簧动画、三种语言的文字
// （岛本身——放在哪、什么时候弹开、鼠标怎么点——在 Island.swift 里。）

import Cocoa
import QuartzCore

/// 岛上的一个按钮
final class IslandButton {
    let command: String
    let layer = CALayer()
    let label = CATextLayer()
    var frame = CGRect.zero             // 在岛的盒子里占哪一块（从上往下算）
    var hot = false                     // 鼠标在上面
    var down = false                    // 正按着

    init(command: String) {
        self.command = command
        layer.cornerRadius = 11
        // 颜色变化留着系统的渐变（鼠标移上去亮一下），其余的不要
        layer.actions = ["position": NSNull(), "bounds": NSNull(), "transform": NSNull(), "hidden": NSNull(), "sublayers": NSNull()]
        label.actions = SpriteLayers.noActions
        label.alignmentMode = .center
        label.truncationMode = .end
        layer.addSublayer(label)
    }
}

extension Island {

    // MARK: 弹开后的那一块

    /// 弹开后的那一块：一行状态、按钮、几行小字。顺便算出它多高。
    func layoutPanel(top panelTop: CGFloat) {
        let inner: CGFloat = openW - 28
        let gap: CGFloat = 7
        let ts = setText(title, titleText(), titleFont)

        // 按钮：丢球、摸摸、集合、（喂饭：引擎有那一套才有）、回岛睡觉 / 出来玩
        var cmds: [String] = ["throw", "love", "gather"]
        if st.care != nil { cmds.append("feed") }
        cmds.append("toggleHome")
        if buttons.map({ $0.command }) != cmds {
            for b in buttons { b.layer.removeFromSuperlayer() }
            buttons = cmds.map { IslandButton(command: $0) }
            for b in buttons { panel.addSublayer(b.layer) }
            pressed = nil
        }
        let n = buttons.count
        let oneW = (inner - gap * CGFloat(n - 1)) / CGFloat(n)
        var fits = true
        var labelH: CGFloat = 15
        for b in buttons {
            let sz = setText(b.label, buttonTitle(b.command), buttonFont)
            labelH = sz.height
            if sz.width + 6 > oneW { fits = false }
        }
        // 一行放得下就一行，放不下就上面三个、下面两个
        var rows: [[IslandButton]] = [buttons]
        if !fits && n > 3 { rows = [Array(buttons[0..<3]), Array(buttons[3..<n])] }

        let lines = footLines()
        while foot.count < lines.count {
            let t = CATextLayer()
            t.actions = SpriteLayers.noActions
            t.alignmentMode = .center
            t.foregroundColor = hexColor(0x8c95a8)
            panel.addSublayer(t)
            foot.append(t)
        }
        while foot.count > lines.count { foot.removeLast().removeFromSuperlayer() }

        let titleTop: CGFloat = 6
        let btnTop: CGFloat = titleTop + ts.height + 9
        let btnH: CGFloat = 33
        let lineH: CGFloat = 18
        let footTop: CGFloat = btnTop + CGFloat(rows.count) * btnH + CGFloat(rows.count - 1) * gap + 10
        panelH = footTop + CGFloat(lines.count) * lineH + 12

        title.frame = CGRect(x: 0, y: snap(panelH - titleTop - ts.height), width: openW, height: ts.height)
        var ri = 0
        for row in rows {
            let cellW = (inner - gap * CGFloat(row.count - 1)) / CGFloat(row.count)
            var ci = 0
            for b in row {
                let bx = 14 + CGFloat(ci) * (cellW + gap)
                let bt = btnTop + CGFloat(ri) * (btnH + gap)
                b.frame = CGRect(x: boxW / 2 - openW / 2 + bx, y: panelTop + bt, width: cellW, height: btnH)
                b.layer.bounds = CGRect(x: 0, y: 0, width: cellW, height: btnH)
                b.layer.position = CGPoint(x: snap(bx + cellW / 2), y: snap(panelH - bt - btnH / 2))
                b.label.frame = CGRect(x: 0, y: snap((btnH - labelH) / 2), width: cellW, height: labelH)
                style(b)
                ci += 1
            }
            ri += 1
        }
        var li = 0
        for s in lines {
            let t = foot[li]
            let sz = setText(t, s, footFont)
            let y = panelH - footTop - CGFloat(li) * lineH - (lineH + sz.height) / 2
            t.frame = CGRect(x: 0, y: snap(y), width: openW, height: sz.height)
            li += 1
        }
    }

    func style(_ b: IslandButton) {
        if b.down {
            b.layer.backgroundColor = hexColor(0xd6e645)
            b.label.foregroundColor = hexColor(0x20222b)
            b.layer.setAffineTransform(CGAffineTransform(scaleX: 0.96, y: 0.96))
        } else {
            b.layer.backgroundColor = hexColor(b.hot ? 0x34384a : 0x20222b)
            b.label.foregroundColor = hexColor(0xffffff)
            b.layer.setAffineTransform(CGAffineTransform.identity)
        }
    }

    // MARK: 形状和动画

    /// 岛的轮廓：从屏幕顶边出发，一小段往里凹的弧接到侧边，直着下来，圆角拐到底边；右边对称。
    func makePath(w: CGFloat, h: CGFloat, top: CGFloat, bottom: CGFloat) -> CGPath {
        let rt = min(top, h / 3)
        let rb = max(1, min(bottom, h - rt - 1, w / 2 - 1))
        let x0 = boxW / 2 - w / 2, x1 = boxW / 2 + w / 2
        let H = boxH
        let p = CGMutablePath()
        p.move(to: CGPoint(x: x0 - rt, y: H))
        p.addQuadCurve(to: CGPoint(x: x0, y: H - rt), control: CGPoint(x: x0, y: H))
        p.addLine(to: CGPoint(x: x0, y: H - h + rb))
        p.addQuadCurve(to: CGPoint(x: x0 + rb, y: H - h), control: CGPoint(x: x0, y: H - h))
        p.addLine(to: CGPoint(x: x1 - rb, y: H - h))
        p.addQuadCurve(to: CGPoint(x: x1, y: H - h + rb), control: CGPoint(x: x1, y: H - h))
        p.addLine(to: CGPoint(x: x1, y: H - rt))
        p.addQuadCurve(to: CGPoint(x: x1 + rt, y: H), control: CGPoint(x: x1, y: H))
        p.closeSubpath()
        return p
    }

    func applyShape(w: CGFloat, h: CGFloat, rt: CGFloat, rb: CGFloat, animated: Bool) {
        let changed = abs(w - bodyW) > 0.01 || abs(h - bodyH) > 0.01
        bodyW = w
        bodyH = h
        let path = makePath(w: w, h: h, top: rt, bottom: rb)
        if animated && changed, let from = shape.presentation()?.path ?? shape.path {
            let a = spring("path")
            a.fromValue = from
            a.toValue = path
            shape.add(a, forKey: "path")
            let c = spring("path")
            c.fromValue = clip.presentation()?.path ?? from
            c.toValue = path
            clip.add(c, forKey: "path")
        }
        shape.path = path
        clip.path = path
    }

    /// 弹簧：弹开时稍微过头再回来，合上时稳稳地收
    func spring(_ keyPath: String) -> CASpringAnimation {
        let a = CASpringAnimation(keyPath: keyPath)
        a.mass = 1
        if isOpen {
            a.stiffness = 224
            a.damping = 24
        } else {
            a.stiffness = 195
            a.damping = 28
        }
        a.initialVelocity = 0
        a.duration = a.settlingDuration
        return a
    }

    func move(_ l: CALayer, to pos: CGPoint, animated: Bool) {
        if animated && l.position != pos {
            let from: CGPoint = l.presentation()?.position ?? l.position
            let a = spring("position")
            a.fromValue = NSValue(point: from)
            a.toValue = NSValue(point: pos)
            l.add(a, forKey: "position")
        }
        l.position = pos
    }

    func fadePanel(to value: Float, delay: CFTimeInterval, duration: CFTimeInterval) {
        let from: Float = panel.presentation()?.opacity ?? panel.opacity
        let a = CABasicAnimation(keyPath: "opacity")
        a.fromValue = from
        a.toValue = value
        a.duration = duration
        if delay > 0 {
            a.beginTime = panel.convertTime(CACurrentMediaTime(), from: nil) + delay
            a.fillMode = .backwards
        }
        panel.add(a, forKey: "fade")
        panel.opacity = value
    }

    static func bowlPath() -> CGPath {
        let p = CGMutablePath()
        p.move(to: CGPoint(x: 0, y: 7))
        p.addLine(to: CGPoint(x: 10, y: 7))
        p.addLine(to: CGPoint(x: 10, y: 5.6))
        p.addQuadCurve(to: CGPoint(x: 7.4, y: 0), control: CGPoint(x: 9.6, y: 0.5))
        p.addLine(to: CGPoint(x: 2.6, y: 0))
        p.addQuadCurve(to: CGPoint(x: 0, y: 5.6), control: CGPoint(x: 0.4, y: 0.5))
        p.closeSubpath()
        return p
    }

    /// 网球上那道弯弯的白线
    static func seamPath() -> CGPath {
        let p = CGMutablePath()
        p.move(to: CGPoint(x: 1.2, y: 6.4))
        p.addQuadCurve(to: CGPoint(x: 7.8, y: 6.4), control: CGPoint(x: 4.5, y: 2.2))
        return p
    }

    // MARK: 字（繁体 / 简体 / 英文）

    func titleText() -> String {
        if let c = st.care, c.meal == "serving" {
            if c.kind == "snack" || c.kind == "biscuit" { return L10n.t("吃點心", "吃点心", "Snack time") }
            return L10n.t("開飯了", "开饭了", "Mealtime")
        }
        switch st.home {
        case "in": return L10n.t("在島裡睡覺", "在岛里睡觉", "Napping at home")
        case "going": return L10n.t("正在回家", "正在回家", "Heading home")
        case "leaving": return L10n.t("出來囉", "出来啦", "Coming out")
        default: return L10n.t("在外面玩", "在外面玩", "Out playing")
        }
    }

    func buttonTitle(_ command: String) -> String {
        switch command {
        case "throw": return L10n.t("丟球", "丢球", "Throw")
        case "love": return L10n.t("摸摸", "摸摸", "Pet")
        case "gather": return L10n.t("集合", "集合", "Come")
        case "feed": return L10n.t("餵飯", "喂饭", "Feed")
        default:
            if st.home == "out" || st.home == "leaving" { return L10n.t("回島睡覺", "回岛睡觉", "Nap") }
            return L10n.t("出來玩", "出来玩", "Play")
        }
    }

    /// "#" 换成数字；英文里 1 的时候用单数那一句
    func counted(_ n: Int, _ hant: String, _ hans: String, _ en: String, _ enOne: String) -> String {
        let text = L10n.t(hant, hans, n == 1 ? enOne : en)
        return text.replacingOccurrences(of: "#", with: String(n))
    }

    func footLines() -> [String] {
        var lines: [String] = []
        lines.append(counted(st.fetch, "今天丟了 # 次球", "今天丢了 # 次球", "# fetches today", "# fetch today") + " · " +
                     counted(st.pets, "摸了 # 次", "摸了 # 次", "# pets", "# pet"))
        // 吃饭、便便那一套：数字大于 0 才写，从来不写 0
        if let c = st.care {
            var today: [String] = []
            if c.meals > 0 { today.append(counted(c.meals, "今天吃了 # 餐", "今天吃了 # 顿", "# meals today", "# meal today")) }
            if c.poops > 0 { today.append(counted(c.poops, "便便 # 次", "拉粑粑 # 次", "# potty breaks", "# potty break")) }
            if !today.isEmpty { lines.append(today.joined(separator: " · ")) }
            var hers: [String] = []
            if c.fedByHer > 0 { hers.append(counted(c.fedByHer, "妳餵了 # 次", "你喂了 # 次", "you fed them #", "you fed them #")) }
            if c.byHer > 0 { hers.append(counted(c.byHer, "妳幫忙清了 # 次", "你帮忙清了 # 次", "you cleaned up #", "you cleaned up #")) }
            if !hers.isEmpty { lines.append(hers.joined(separator: " · ")) }
            if c.lucky { lines.append(L10n.t("今天有狗屎運！", "今天有狗屎运！", "Lucky day!")) }
        }
        var extra = clockTexts()
        if let d = daysText() { extra.append(d) }
        if !extra.isEmpty { lines.append(extra.joined(separator: " · ")) }
        return lines
    }

    func clockTexts() -> [String] {
        if clocks.isEmpty { return [] }
        var out: [String] = []
        let now = Date()
        for c in clocks {
            clockFormat.timeZone = c.zone
            out.append(c.label + " " + clockFormat.string(from: now))
        }
        return out
    }

    func daysText() -> String? {
        guard let day = reunion else { return nil }
        let left = Int(ceil(day.timeIntervalSince(Date()) / 86400.0))
        if left < 0 || left > 100000 { return nil }
        return counted(left, "還有 # 天見面", "还有 # 天见面", "# days to go", "# day to go")
    }
}
