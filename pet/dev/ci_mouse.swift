// 只给 CI 用：模拟"把鼠标移到小球上 → 按住 → 往斜上方甩 → 松开"，验证鼠标这条路是通的。
// 用法：ci_mouse <x> <y> <dx> <dy>   （屏幕坐标，原点在左上角）
import Cocoa

let a = CommandLine.arguments.dropFirst().compactMap { Double($0) }
guard a.count == 4 else { print("usage: ci_mouse x y dx dy"); exit(2) }
let start = CGPoint(x: a[0], y: a[1])
let end = CGPoint(x: a[0] + a[2], y: a[1] + a[3])

func post(_ type: CGEventType, _ p: CGPoint) {
    guard let e = CGEvent(mouseEventSource: nil, mouseType: type, mouseCursorPosition: p, mouseButton: .left) else {
        print("could not create event"); return
    }
    e.post(tap: .cghidEventTap)
}

print("AXIsProcessTrusted:", AXIsProcessTrusted())
CGWarpMouseCursorPosition(start)
post(.mouseMoved, start)
usleep(160_000)
post(.mouseMoved, CGPoint(x: start.x + 1, y: start.y))
usleep(160_000)
print("cursor now at:", NSEvent.mouseLocation)
post(.leftMouseDown, start)
usleep(120_000)
let steps = 14
for i in 1...steps {
    let t = Double(i) / Double(steps)
    post(.leftMouseDragged, CGPoint(x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t))
    usleep(14_000)
}
post(.leftMouseUp, end)
print("posted drag from \(start) to \(end)")
