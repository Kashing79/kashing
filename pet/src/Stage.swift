// 球球 · 画面
//
// 引擎每一帧给一张"从后到前"的清单（每一项：哪张图、贴在哪）。
// 这里把它变成一层层的图：清单里每个 id 对应一层，位置变了就挪，图变了就换，没了就拿掉。
// 图层不做系统自带的渐变动画，放大时不抹匀，位置对齐到屏幕的像素上。
// 另外还有：小人说话时头顶上的气泡。

import Cocoa
import QuartzCore

/// "0xrrggbb" 那样的颜色
func hexColor(_ rgb: Int, _ alpha: CGFloat = 1) -> CGColor {
    let r = CGFloat((rgb >> 16) & 255) / 255
    let g = CGFloat((rgb >> 8) & 255) / 255
    let b = CGFloat(rgb & 255) / 255
    return NSColor(srgbRed: r, green: g, blue: b, alpha: alpha).cgColor
}

// MARK: - 一组图层

final class SpriteLayers {
    let container = CALayer()

    private final class Node {
        let layer = CALayer()
        var texKey = ""
        var ver = -1
        var flip = false
    }
    private var nodes: [String: Node] = [:]
    private var order: [String] = []

    /// 改图层的属性时不要系统自带的渐变动画
    static let noActions: [String: CAAction] = [
        "contents": NSNull(), "position": NSNull(), "bounds": NSNull(), "frame": NSNull(), "opacity": NSNull(),
        "transform": NSNull(), "sublayers": NSNull(), "hidden": NSNull(), "path": NSNull(),
        "backgroundColor": NSNull(), "fillColor": NSNull(), "foregroundColor": NSNull(), "string": NSNull(),
    ]

    init() {
        container.actions = SpriteLayers.noActions
    }

    /// 照着清单摆。
    ///   unit      一个世界单位是几 pt
    ///   backing   一 pt 是几个屏幕像素
    ///   originX / originTop   世界的 (0, 0) 在这组图层里的哪里（pt；originTop 从上往下算）
    func apply(_ items: [SpriteItem], unit: CGFloat, backing: CGFloat, originX: CGFloat, originTop: CGFloat) {
        let ch = container.bounds.height
        let b: CGFloat = backing > 0 ? backing : 1
        var ids: [String] = []
        ids.reserveCapacity(items.count)
        var seen = Set<String>()
        for it in items {
            guard let image = it.image else { continue }
            var id = it.id
            if seen.contains(id) { id = id + "~" + String(ids.count) }     // 同一帧里撞了名字：各算各的
            seen.insert(id)
            ids.append(id)

            let node: Node
            if let found = nodes[id] {
                node = found
            } else {
                node = Node()
                node.layer.magnificationFilter = .nearest
                node.layer.minificationFilter = .nearest
                node.layer.actions = SpriteLayers.noActions
                nodes[id] = node
            }
            if node.texKey != it.texKey || node.ver != it.ver {
                node.layer.contents = image
                node.texKey = it.texKey
                node.ver = it.ver
            }
            // 大小按世界单位换算；左上角对齐到屏幕像素
            let w = CGFloat(it.w) * unit
            let h = CGFloat(it.h) * unit
            let left = ((originX + CGFloat(it.x) * unit) * b).rounded() / b
            let top = ((originTop + CGFloat(it.y) * unit) * b).rounded() / b
            let bounds = CGRect(x: 0, y: 0, width: w, height: h)
            if node.layer.bounds != bounds { node.layer.bounds = bounds }
            let pos = CGPoint(x: left + w / 2, y: ch - top - h / 2)
            if node.layer.position != pos { node.layer.position = pos }
            if node.flip != it.flip {
                node.flip = it.flip
                node.layer.setAffineTransform(it.flip ? CGAffineTransform(scaleX: -1, y: 1) : CGAffineTransform.identity)
            }
            let a = Float(max(0, min(1, it.alpha)))
            if node.layer.opacity != a { node.layer.opacity = a }
        }
        // 谁在前谁在后变了（或者多了少了）：按新的顺序重新叠一遍
        if ids != order {
            var list: [CALayer] = []
            list.reserveCapacity(ids.count)
            for id in ids {
                if let n = nodes[id] { list.append(n.layer) }
            }
            container.sublayers = list
            if nodes.count > ids.count {
                let keep = Set(ids)
                for key in Array(nodes.keys) where !keep.contains(key) { nodes[key] = nil }
            }
            order = ids
        }
    }

    func clear() {
        if order.isEmpty && nodes.isEmpty { return }
        container.sublayers = nil
        nodes.removeAll()
        order.removeAll()
    }

    var count: Int { return order.count }
}

// MARK: - 小人说话的气泡

final class BubbleLayer {
    let root = CALayer()
    private let shadow = CAShapeLayer()
    private let body = CAShapeLayer()
    private let label = CATextLayer()
    private let font = NSFont.systemFont(ofSize: 13, weight: .semibold)

    private var shownKey = ""
    private var showing = false
    private var bodySize = CGSize.zero      // 气泡主体多大（不算小尾巴）
    private var textSize = CGSize.zero
    private var tailAt: CGFloat = -1

    private let pad: CGFloat = 4            // 四周留一点，放描边和影子
    private let tailH: CGFloat = 6

    init() {
        root.actions = SpriteLayers.noActions
        root.opacity = 0
        shadow.actions = SpriteLayers.noActions
        body.actions = SpriteLayers.noActions
        label.actions = SpriteLayers.noActions
        shadow.fillColor = hexColor(0x2a1f2d, 0.25)
        body.fillColor = hexColor(0xfffdf7)
        body.strokeColor = hexColor(0x2a1f2d)
        body.lineWidth = 2
        body.lineJoin = .round
        label.font = font
        label.fontSize = 13
        label.foregroundColor = hexColor(0x2a1f2d)
        label.alignmentMode = .center
        label.isWrapped = true
        label.truncationMode = .none
        root.addSublayer(shadow)
        root.addSublayer(body)
        root.addSublayer(label)
    }

    /// text 是 nil = 没在说话。anchorX / anchorTop：小人头顶在画面里的位置（pt，从上往下算）。
    func update(text: String?, key: String, anchorX: CGFloat, anchorTop: CGFloat, viewSize: CGSize, backing: CGFloat) {
        guard let words = text, !words.isEmpty else {
            if showing { showing = false; fade(to: 0) }
            return
        }
        let b: CGFloat = backing > 0 ? backing : 1
        if key != shownKey || !showing {
            shownKey = key
            measure(words, backing: b)
            tailAt = -1
            if !showing { showing = true; fade(to: 1) }
        }
        let bw = bodySize.width, bh = bodySize.height
        // 气泡在小人头顶上方，左右不出屏幕；小尾巴尽量还指着他
        var cx = anchorX
        let half = bw / 2 + 6
        if viewSize.width > half * 2 { cx = min(max(cx, half), viewSize.width - half) }
        var bottom = anchorTop - 14                 // 气泡主体的下沿（从上往下算）
        if bottom - bh < 2 { bottom = bh + 2 }
        var tail = anchorX - (cx - bw / 2)
        tail = min(max(tail, 16), max(16, bw - 16))
        if abs(tail - tailAt) > 0.5 {
            tailAt = tail
            let path = BubbleLayer.outline(width: bw, height: bh, tailX: tail, tailH: tailH, radius: 9, inset: pad)
            body.path = path
            shadow.path = path
        }
        let rw = bw + pad * 2, rh = bh + tailH + pad * 2
        let left = ((cx - bw / 2 - pad) * b).rounded() / b
        let low = ((viewSize.height - bottom - tailH - pad) * b).rounded() / b
        root.frame = CGRect(x: left, y: low, width: rw, height: rh)
        body.frame = CGRect(x: 0, y: 0, width: rw, height: rh)
        shadow.frame = CGRect(x: 2, y: -2, width: rw, height: rh)
        label.frame = CGRect(x: pad + (bw - textSize.width) / 2, y: pad + tailH + (bh - textSize.height) / 2,
                             width: textSize.width, height: textSize.height)
    }

    private func measure(_ words: String, backing: CGFloat) {
        let maxW: CGFloat = 240
        let attrs: [NSAttributedString.Key: Any] = [.font: font]
        let r = (words as NSString).boundingRect(with: CGSize(width: maxW, height: 2000),
                                                 options: [.usesLineFragmentOrigin, .usesFontLeading], attributes: attrs)
        textSize = CGSize(width: min(maxW, ceil(r.width)) + 4, height: ceil(r.height) + 2)
        bodySize = CGSize(width: textSize.width + 20, height: textSize.height + 14)
        label.string = words
        label.contentsScale = backing
        body.contentsScale = backing
        shadow.contentsScale = backing
    }

    /// 圆角方框，下边带一个小尖角。坐标是图层自己的（y 朝上），框的左下角在 (inset, inset + tailH)。
    private static func outline(width: CGFloat, height: CGFloat, tailX: CGFloat, tailH: CGFloat, radius: CGFloat, inset: CGFloat) -> CGPath {
        let x0 = inset, x1 = inset + width
        let y0 = inset + tailH, y1 = inset + tailH + height
        let r = min(radius, height / 2, width / 2)
        let tx = inset + tailX
        let p = CGMutablePath()
        p.move(to: CGPoint(x: x0 + r, y: y0))
        p.addLine(to: CGPoint(x: tx - 6, y: y0))
        p.addLine(to: CGPoint(x: tx, y: y0 - tailH))
        p.addLine(to: CGPoint(x: tx + 6, y: y0))
        p.addLine(to: CGPoint(x: x1 - r, y: y0))
        p.addQuadCurve(to: CGPoint(x: x1, y: y0 + r), control: CGPoint(x: x1, y: y0))
        p.addLine(to: CGPoint(x: x1, y: y1 - r))
        p.addQuadCurve(to: CGPoint(x: x1 - r, y: y1), control: CGPoint(x: x1, y: y1))
        p.addLine(to: CGPoint(x: x0 + r, y: y1))
        p.addQuadCurve(to: CGPoint(x: x0, y: y1 - r), control: CGPoint(x: x0, y: y1))
        p.addLine(to: CGPoint(x: x0, y: y0 + r))
        p.addQuadCurve(to: CGPoint(x: x0 + r, y: y0), control: CGPoint(x: x0, y: y0))
        p.closeSubpath()
        return p
    }

    /// 慢慢出现 / 慢慢消失
    private func fade(to value: Float) {
        let from: Float = root.presentation()?.opacity ?? root.opacity
        let a = CABasicAnimation(keyPath: "opacity")
        a.fromValue = from
        a.toValue = value
        a.duration = 0.25
        root.add(a, forKey: "fade")
        root.opacity = value
    }
}
