// 球球 · Mac 外壳（第三版：全部原生，不开网页）
//
// 一个透明、没有边框、永远在最上层、铺满整个屏幕的窗口，上面是一层层的图：
// 穿西装的小人、小腊肠、大金毛、小球，还有屏幕顶上的"岛"。桌面上另有一层像素草地。
// 平时鼠标可以直接穿过这个窗口；只有移到小人、小狗、小球、岛上时才会被接住。
//
// 玩法是 web/ 里的 JavaScript，用系统自带的 JavaScriptCore 直接跑。
// 不联网，不需要任何系统权限（不读屏幕、不读键盘）。
//
// 文件怎么分的：
//   main.swift      入口（就是这个文件）
//   App.swift       启动、几个设定、屏幕有多大、窗口放在哪
//   Engine.swift    跑 JavaScript 的那一头：读文件、建引擎、每一帧问它该画什么
//   Glue.swift      和引擎跑在一起的一小段 JavaScript（把清单压成 Swift 好拿的样子）
//   Frame.swift     引擎交过来的东西长什么样；把像素变成图
//   Stage.swift     把"这一帧该画什么"变成图层；小人说话的气泡
//   Loop.swift      每秒画几帧、什么时候可以歇着
//   Input.swift     鼠标：穿透、点、拖
//   Island.swift    屏幕顶上的岛；IslandParts.swift 是它的零件（按钮、轮廓、文字）
//   Lawn.swift      桌面上的草地
//   Menu.swift      菜单栏的 🎾 和菜单、三种语言的文字、开机自动启动
//   Sense.swift     外面的事：屏幕睡了醒了、她多久没碰电脑、电量
//   SelfTest.swift  自检

import Cocoa

setvbuf(stdout, nil, _IOLBF, 0)

// 已经有一个在跑了就不要再开第二个（自检除外）
if !CommandLine.arguments.contains("--selftest") {
    let mine = ProcessInfo.processInfo.processIdentifier
    let others = NSRunningApplication.runningApplications(withBundleIdentifier: kBundleID)
        .filter { $0.processIdentifier != mine }
    if !others.isEmpty { exit(0) }
}

let application = NSApplication.shared
let appDelegate = AppDelegate()
application.delegate = appDelegate
application.setActivationPolicy(.accessory)
application.run()
