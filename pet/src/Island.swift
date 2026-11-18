// 球球 · 屏幕顶上的"岛"（小人和狗狗的家）
//   · 平时是贴着屏幕顶边的一小块黑色（有刘海的屏幕上包着刘海，没有的就在菜单栏正中间）：
//     左边小球 + 今天丢了几次，右边爱心 + 今天摸了几次（都在岛里睡觉时是 zzz）
//   · 鼠标停一小会儿会弹开：一行状态、几个按钮、今天的小统计
//   · 它们回岛睡觉时，岛会长高一截，看得到它们睡着的样子
// 形状：上面两个角是贴着屏幕顶边往里凹的小圆弧，下面两个角是圆角；变大变小时像弹簧一样弹一下。
// 里面的位置都按"从上往下"算（屏幕顶是 0），摆图层的时候再换成图层自己的坐标（y 朝上）。

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

final class Island {
    let layer = CALayer()               // 岛的盒子：顶边贴着屏幕顶，左右以岛的中心为准
    let den = SpriteLayers()            // 它们在岛里睡觉的那一小格
    private(set) var enabled = true
    private(set) var isOpen = false

    // —— 版面（pt）——
    private var notchW: CGFloat = 0
    private var barH: CGFloat = 24
    private var backing: CGFloat = 2
    private let boxW: CGFloat = 420
    private var boxH: CGFloat = 400
    private var boxLeft: CGFloat = 0            // 盒子的左边在面板里的 x
    private var bodyW: CGFloat = 150            // 黑色那一块（要变成）多宽多高
    private var bodyH: CGFloat = 24
    private var panelH: CGFloat = 128
    private let openW: CGFloat = 340
    private let denAreaH: CGFloat = 62
    private let denUnit: CGFloat = 2            // 那一小格里，一个世界单位画成 2pt
    private var denSize = CGSize(width: 248, height: 56)
    private var laidOut = false
    private var paintKey = ""

    // —— 引擎那边现在的样子 ——
    private var st = EngineStatus()
    private var clocks: [(label: String, zone: TimeZone)] = []
    private var reunion: Date? = nil
    private let clockFormat = DateFormatter()

    // —— 图层 ——
    private let shape = CAShapeLayer()          // 黑色的岛
    private let content = CALayer()             // 岛上的东西（被岛的形状裁住）
    private let clip = CAShapeLayer()
    private let leftGroup = CALayer()
    private let rightGroup = CALayer()
    private let bowl = CAShapeLayer()
    private let ball = CAShapeLayer()
    private let seam = CAShapeLayer()
    private let fetchText = CATextLayer()
    private let heartText = CATextLayer()
    private let petsText = CATextLayer()
    private let panel = CALayer()               // 弹开以后才看得到的那一块
    private let title = CATextLayer()
    private var buttons: [IslandButton] = []
    private var foot: [CATextLayer] = []

    private let barFont = NSFont.monospacedDigitSystemFont(ofSize: 12, weight: .semibold)
    private let titleFont = NSFont.systemFont(ofSize: 13, weight: .semibold)
    private let buttonFont = NSFont.systemFont(ofSize: 12, weight: .semibold)
    private let footFont = NSFont.monospacedDigitSystemFont(ofSize: 11, weight: .medium)

    // —— 鼠标 ——
    private var hoverInside = false
    private var openAt: CFTimeInterval = 0
    private var closeAt: CFTimeInterval = 0
    private var pressed: IslandButton? = nil
    private var downInside = false

    init() {
        clockFormat.locale = Locale(identifier: "en_GB")
        clockFormat.dateFormat = "HH:mm"
        let plain: [CALayer] = [layer, shape, content, clip, leftGroup, rightGroup, bowl, ball, seam,
                                fetchText, heartText, petsText, panel, title]
        for l in plain { l.actions = SpriteLayers.noActions }
        shape.fillColor = hexColor(0x000000)
        clip.fillColor = hexColor(0x000000)
        content.mask = clip
        layer.addSublayer(shape)
        layer.addSublayer(content)

        bowl.fillColor = hexColor(0xffffff, 0.7)
        bowl.path = Island.bowlPath()
        bowl.isHidden = true
        ball.fillColor = hexColor(0xd6e645)
        ball.path = CGPath(ellipseIn: CGRect(x: 0, y: 0, width: 9, height: 9), transform: nil)
        seam.fillColor = nil
        seam.strokeColor = hexColor(0xffffff, 0.8)
        seam.lineWidth = 1
        seam.lineCap = .round
        seam.path = Island.seamPath()
        fetchText.foregroundColor = hexColor(0xffffff)
        heartText.foregroundColor = hexColor(0xff7a9a)
        petsText.foregroundColor = hexColor(0x9aa3b5)
        title.foregroundColor = hexColor(0xcfd6e4)
        title.alignmentMode = .center
        leftGroup.anchorPoint = CGPoint(x: 0, y: 0)
        rightGroup.anchorPoint = CGPoint(x: 0, y: 0)
        leftGroup.addSublayer(bowl)
        leftGroup.addSublayer(ball)
        leftGroup.addSublayer(seam)
        leftGroup.addSublayer(fetchText)
        rightGroup.addSublayer(heartText)
        rightGroup.addSublayer(petsText)
        panel.opacity = 0
        panel.addSublayer(title)
        den.container.isHidden = true
        content.addSublayer(leftGroup)
        content.addSublayer(rightGroup)
        content.addSublayer(den.container)
        content.addSublayer(panel)
    }

    // MARK: 外面告诉我们的

    /// 刚启动 / 屏幕变了：岛的中心在哪、刘海多宽（没有就是 0）、菜单栏多高
    func configure(viewSize: CGSize, centerX: CGFloat, notchW nw: CGFloat, barH bh: CGFloat, backing b: CGFloat) {
        backing = b > 0 ? b : 1
        notchW = max(0, nw)
        barH = max(20, bh)
        boxH = barH + denAreaH + 320
        boxLeft = ((centerX - boxW / 2) * backing).rounded() / backing
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        layer.frame = CGRect(x: boxLeft, y: viewSize.height - boxH, width: boxW, height: boxH)
        let full = CGRect(x: 0, y: 0, width: boxW, height: boxH)
        shape.frame = full
        content.frame = full
        clip.frame = full
        let crisp: [CALayer] = [shape, clip, bowl, ball, seam, fetchText, heartText, petsText, title]
        for l in crisp { l.contentsScale = backing }
        panel.removeAnimation(forKey: "fade")
        panel.opacity = isOpen ? 1 : 0
        laidOut = true
        paintKey = ""
        refresh(animated: false)
        CATransaction.commit()
    }

    /// config.js 里的两地时间、见面的日子
    func setConfig(clock: [[String: Any]], reunion day: String?) {
        clocks = []
        for c in clock {
            if let label = c["label"] as? String, let tz = c["tz"] as? String, let zone = TimeZone(identifier: tz) {
                clocks.append((label: label, zone: zone))
            }
        }
        reunion = nil
        if let s = day, !s.isEmpty {
            let f = DateFormatter()
            f.locale = Locale(identifier: "en_US_POSIX")
            f.dateFormat = "yyyy-MM-dd"
            reunion = f.date(from: s)
        }
        paintKey = ""
        refresh(animated: false)
    }

    func setEnabled(_ on: Bool) {
        if enabled == on { return }
        enabled = on
        if !on {
            isOpen = false; openAt = 0; closeAt = 0; pressed = nil; downInside = false; hoverInside = false
            panel.removeAnimation(forKey: "fade")
            panel.opacity = 0
        }
        paintKey = ""
        refresh(animated: false)
    }

    func update(_ status: EngineStatus) {
        st = status
        refresh(animated: true)
    }

    var showsDen: Bool { return enabled && laidOut && isHomey }

    func drawDen(_ d: DenFrame) {
        let size = CGSize(width: CGFloat(d.w) * denUnit, height: CGFloat(d.h) * denUnit)
        if size.width > 0 && size.height > 0 && size != denSize {
            denSize = size
            paintKey = ""
            refresh(animated: true)
        }
        den.apply(d.items, unit: denUnit, backing: backing, originX: 0, originTop: 0)
    }

    func clearDen() { den.clear() }

    /// 岛在面板里占的范围（pt，从上往下算，四周留了一点边）；关掉了就没有
    var rect: CGRect? {
        if !enabled || !laidOut { return nil }
        return CGRect(x: midX - bodyW / 2 - 6, y: 0, width: bodyW + 12, height: bodyH + 8)
    }
    var midX: CGFloat { return boxLeft + boxW / 2 }

    func contains(_ p: CGPoint) -> Bool {
        guard let r = rect else { return false }
        return r.contains(p)
    }

    /// 把谁拎到岛上（或者岛旁边）放下，算不算"送回岛里"
    func dropHit(_ p: CGPoint) -> Bool {
        guard let r = rect else { return false }
        return p.x >= r.minX - 6 && p.x <= r.maxX + 6 && p.y <= r.maxY + 22
    }

    // MARK: 鼠标

    /// 每秒 30 次。p：鼠标在面板里的位置；mouseDown：鼠标键按着；dragging：她正拖着球 / 拎着谁
    func hover(_ p: CGPoint, mouseDown: Bool, dragging: Bool, now: CFTimeInterval) {
        if !enabled || !laidOut { return }
        // 她正拖着球、或者按着鼠标拖别的东西路过：不要弹开挡路
        let blocked = dragging || (mouseDown && !downInside)
        let inside = !blocked && contains(p)
        hoverInside = inside
        if inside {
            closeAt = 0
            if !isOpen && openAt == 0 { openAt = now + 0.25 }      // 停够一小会儿才弹开
        } else {
            openAt = 0
            if isOpen && closeAt == 0 { closeAt = now + 0.38 }
        }
        if openAt > 0 && now >= openAt {
            openAt = 0
            if hoverInside { setOpen(true) }
        }
        if closeAt > 0 && now >= closeAt {
            closeAt = 0
            if !hoverInside { setOpen(false) }
        }
        let over: IslandButton? = inside ? button(at: p) : nil
        for b in buttons {
            let h = (b === over)
            if b.hot != h {
                b.hot = h
                CATransaction.begin()
                CATransaction.setAnimationDuration(0.12)
                style(b)
                CATransaction.commit()
            }
        }
    }

    /// 返回 true = 这一下点在岛上，归岛管
    func mouseDown(_ p: CGPoint) -> Bool {
        guard contains(p) else { downInside = false; return false }
        downInside = true
        hoverInside = true
        openAt = 0
        closeAt = 0
        pressed = button(at: p)
        if let b = pressed {
            b.down = true
            style(b)
        } else {
            setOpen(!isOpen)
        }
        return true
    }

    /// 松开。返回要引擎做的事（按在按钮上才有）
    func mouseUp(_ p: CGPoint) -> String? {
        let b = pressed
        pressed = nil
        downInside = false
        guard let btn = b else { return nil }
        btn.down = false
        style(btn)
        let q = CGPoint(x: p.x - boxLeft, y: p.y)
        return btn.frame.insetBy(dx: -8, dy: -8).contains(q) ? btn.command : nil
    }

    func cancelPress() {
        if let b = pressed { b.down = false; style(b) }
        pressed = nil
        downInside = false
    }

    private func button(at p: CGPoint) -> IslandButton? {
        if !isOpen { return nil }
        let q = CGPoint(x: p.x - boxLeft, y: p.y)
        for b in buttons where b.frame.contains(q) { return b }
        return nil
    }

    private func setOpen(_ v: Bool) {
        if isOpen == v { return }
        isOpen = v
        refresh(animated: true)
        fadePanel(to: v ? 1 : 0, delay: v ? 0.08 : 0, duration: v ? 0.2 : 0.12)
    }

    // MARK: 摆

    private var isHomey: Bool { return st.home == "in" || st.home == "going" }

    /// 小碗：从喊开饭到碗收走；或者该吃饭了但它们还在岛里
    private var showsBowl: Bool {
        guard let c = st.care else { return false }
        return c.meal == "serving" || (c.meal == "due" && st.home == "in")
    }

    private func snap(_ v: CGFloat) -> CGFloat { return (v * backing).rounded() / backing }

    private func refresh(animated: Bool) {
        if !laidOut { return }
        let key = makeKey()
        if key == paintKey { return }
        paintKey = key
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        rebuild(animated: animated)
        CATransaction.commit()
    }

    private func makeKey() -> String {
        var k = "\(enabled)|\(isOpen)|\(st.home)|\(st.fetch)|\(st.pets)"
        if let c = st.care {
            k += "|care:\(c.meal),\(c.kind ?? "-"),\(c.meals),\(c.poops),\(c.fedByHer),\(c.byHer),\(c.lucky)"
        }
        k += "|" + clockTexts().joined(separator: ",") + "|" + (daysText() ?? "")
        return k
    }

    /// 把一行字放进文字图层，返回这行字多宽多高
    private func setText(_ t: CATextLayer, _ s: String, _ font: NSFont) -> CGSize {
        t.string = s
        t.font = font
        t.fontSize = font.pointSize
        t.contentsScale = backing
        let sz = (s as NSString).size(withAttributes: [.font: font])
        return CGSize(width: ceil(sz.width) + 1, height: ceil(sz.height))
    }

    private func rebuild(animated: Bool) {
        layer.isHidden = !enabled
        let homey = isHomey
        let gh = barH

        // —— 顶上那一条，左边：小碗（开饭时）、小球、今天丢了几次 ——
        var x: CGFloat = 0
        let bowlOn = showsBowl
        bowl.isHidden = !bowlOn
        if bowlOn {
            bowl.frame = CGRect(x: 0, y: snap((gh - 7) / 2), width: 10, height: 7)
            x += 15
        }
        ball.frame = CGRect(x: x, y: snap((gh - 9) / 2), width: 9, height: 9)
        seam.frame = ball.frame
        x += 14
        let fs = setText(fetchText, String(st.fetch), barFont)
        fetchText.frame = CGRect(x: x, y: snap((gh - fs.height) / 2), width: fs.width, height: fs.height)
        let leftW = x + fs.width

        // —— 右边：爱心 + 今天摸了几次；都在岛里睡觉时是 zzz ——
        var rightW: CGFloat = 0
        if st.home == "in" {
            heartText.isHidden = true
            petsText.isHidden = false
            let zs = setText(petsText, "zzz", barFont)
            petsText.frame = CGRect(x: 0, y: snap((gh - zs.height) / 2), width: zs.width, height: zs.height)
            rightW = zs.width
        } else {
            heartText.isHidden = false
            let hs = setText(heartText, "\u{2665}\u{FE0E}", barFont)
            heartText.frame = CGRect(x: 0, y: snap((gh - hs.height) / 2), width: hs.width, height: hs.height)
            rightW = hs.width
            if st.pets > 0 {
                petsText.isHidden = false
                let ps = setText(petsText, String(st.pets), barFont)
                petsText.frame = CGRect(x: rightW + 3, y: snap((gh - ps.height) / 2), width: ps.width, height: ps.height)
                rightW += 3 + ps.width
            } else {
                petsText.isHidden = true
            }
        }

        // —— 黑色那一块多大：合着 / 它们在家（多一格）/ 弹开 ——
        let wing: CGFloat = max(44, leftW + 14, rightW + 14)
        let closedW: CGFloat = notchW > 0 ? notchW + wing * 2 : max(150, leftW + rightW + 48)
        let denH: CGFloat = homey ? denAreaH : 0
        layoutPanel(top: barH + denH)
        var w = closedW, h = barH
        var rt: CGFloat = 6, rb: CGFloat = 14
        if isOpen {
            w = max(openW, closedW); h = barH + denH + panelH; rt = 19; rb = 24
        } else if homey {
            w = max(denSize.width + 24, closedW); h = barH + denH
        }

        // 左右两小组：有刘海就各自待在刘海两边的正中；没有就靠着两头
        let cx = boxW / 2
        let bodyLeft = cx - w / 2, bodyRight = cx + w / 2
        var lx = bodyLeft + 12
        var rx = bodyRight - 12 - rightW
        if notchW > 0 {
            lx = (bodyLeft + cx - notchW / 2) / 2 - leftW / 2
            rx = (cx + notchW / 2 + bodyRight) / 2 - rightW / 2
        }
        leftGroup.bounds = CGRect(x: 0, y: 0, width: leftW, height: gh)
        rightGroup.bounds = CGRect(x: 0, y: 0, width: rightW, height: gh)
        move(leftGroup, to: CGPoint(x: snap(lx), y: boxH - barH), animated: animated)
        move(rightGroup, to: CGPoint(x: snap(rx), y: boxH - barH), animated: animated)

        // 睡觉的那一小格
        den.container.isHidden = !homey
        if homey {
            let top = barH + (denAreaH - denSize.height) / 2
            den.container.frame = CGRect(x: snap(cx - denSize.width / 2), y: snap(boxH - top - denSize.height),
                                         width: denSize.width, height: denSize.height)
        }
        panel.frame = CGRect(x: snap(cx - openW / 2), y: snap(boxH - barH - denH - panelH), width: openW, height: panelH)
        applyShape(w: w, h: h, rt: rt, rb: rb, animated: animated)
    }

    /// 弹开后的那一块：一行状态、按钮、几行小字。顺便算出它多高。
    private func layoutPanel(top panelTop: CGFloat) {
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

    private func style(_ b: IslandButton) {
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
    private func makePath(w: CGFloat, h: CGFloat, top: CGFloat, bottom: CGFloat) -> CGPath {
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

    private func applyShape(w: CGFloat, h: CGFloat, rt: CGFloat, rb: CGFloat, animated: Bool) {
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
    private func spring(_ keyPath: String) -> CASpringAnimation {
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

    private func move(_ l: CALayer, to pos: CGPoint, animated: Bool) {
        if animated && l.position != pos {
            let from: CGPoint = l.presentation()?.position ?? l.position
            let a = spring("position")
            a.fromValue = NSValue(point: from)
            a.toValue = NSValue(point: pos)
            l.add(a, forKey: "position")
        }
        l.position = pos
    }

    private func fadePanel(to value: Float, delay: CFTimeInterval, duration: CFTimeInterval) {
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

    private static func bowlPath() -> CGPath {
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
    private static func seamPath() -> CGPath {
        let p = CGMutablePath()
        p.move(to: CGPoint(x: 1.2, y: 6.4))
        p.addQuadCurve(to: CGPoint(x: 7.8, y: 6.4), control: CGPoint(x: 4.5, y: 2.2))
        return p
    }

    // MARK: 字（繁体 / 简体 / 英文）

    private func titleText() -> String {
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

    private func buttonTitle(_ command: String) -> String {
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
    private func counted(_ n: Int, _ hant: String, _ hans: String, _ en: String, _ enOne: String) -> String {
        let text = L10n.t(hant, hans, n == 1 ? enOne : en)
        return text.replacingOccurrences(of: "#", with: String(n))
    }

    private func footLines() -> [String] {
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

    private func clockTexts() -> [String] {
        if clocks.isEmpty { return [] }
        var out: [String] = []
        let now = Date()
        for c in clocks {
            clockFormat.timeZone = c.zone
            out.append(c.label + " " + clockFormat.string(from: now))
        }
        return out
    }

    private func daysText() -> String? {
        guard let day = reunion else { return nil }
        let left = Int(ceil(day.timeIntervalSince(Date()) / 86400.0))
        if left < 0 || left > 100000 { return nil }
        return counted(left, "還有 # 天見面", "还有 # 天见面", "# days to go", "# day to go")
    }
}
