# 球球（QiuQiu）· 给 Claude Code 的说明

你好。这个文件夹是别人送给这台 Mac 主人的一份小礼物：一个离线的桌面宠物。

装好以后，屏幕最上面正中间（菜单栏里 / 刘海那里）会出现一颗黑色的小"岛"，
一个穿西装的像素小人、一只小腊肠、一只大金毛会从岛里跳出来，在整个屏幕上到处跑、玩球、互相闹；
小人会按时喂狗、帮狗狗收拾粑粑；桌面上（她的窗口和桌面图标后面）铺着一片像素草地。

它是一个真正的 Mac 程序（AppKit + Core Animation，玩法是 `web/` 里的 JavaScript，用系统自带的 JavaScriptCore 跑）。
它完全在本机运行：**不联网、没有 API、不需要任何系统权限、不用 sudo**，不读屏幕、不读键盘。
跟她说话时，请用她平常跟你说话的语言。

## 她说"帮我安装"时

1. **先看一眼要运行的东西**：`install.sh`（不长）和 `src/` 里的几个 `.swift` 文件。
2. **确认有 Swift 编译器**：

   ```bash
   xcode-select -p && xcrun swiftc --version
   ```

   如果报错，说明没装苹果的 Command Line Tools。运行 `xcode-select --install`，
   请她在弹出的窗口里点「安装」，等它装完（几分钟）再继续。
3. **问她一句**：要不要每次开机自动出现？
   - 要：`bash install.sh --autostart`
   - 不要：`bash install.sh`

   （请用 `bash install.sh`，不要用 `./install.sh`。）
4. **验证**：

   ```bash
   pgrep -x QiuQiu          # 有数字输出 = 正在运行
   ```

   想更确定，可以跑自检。它会把画面画到一张图里，并检查宠物真的画出来了、背景是透明的：

   ```bash
   APP=/Applications/QiuQiu.app; [ -d "$APP" ] || APP="$HOME/Applications/QiuQiu.app"
   "$APP/Contents/MacOS/QiuQiu" --selftest /tmp/qiuqiu.png   # 最后一行应该是 SELFTEST PASS
   ```

   然后可以打开 `/tmp/qiuqiu.png` 看一眼。自检里 `SELFTEST jit fast` 表示 JavaScript 跑得够快（见下面"遇到问题时"）。
5. **告诉她怎么玩**（见下一节）。

另一种装法（不用解压缩包）：在终端里运行
`curl -fsSL https://raw.githubusercontent.com/Kashing79/kashing/main/pet/get.sh | bash`，
它会把这个文件夹下载到 `~/QiuQiu` 再运行 `install.sh`。

## 怎么玩

- 它们在**整个屏幕**上活动（不会走到菜单栏和程序坞上）。桌面上的草地在所有窗口后面，不挡任何东西。
- **拖住小球甩出去**，狗狗会去追，再叼回来给小人。**点小人**，他会丢球。
- **点小狗**，摸摸它；点它的**鼻子**会打喷嚏；鼠标在它身上**来回蹭**是挠痒痒。
- **按住拖走**可以把小人或小狗拎到别的地方；放到金毛背上、放进小人怀里都会有反应。
- 把谁拎到顶上的**岛**上放开：大家回岛睡觉。
- 鼠标移到岛上，岛会展开：丢球 / 摸摸 / 集合 / 喂饭 / 回岛睡觉（在岛里时是"出来玩"）。
- 它们平时自己会演一百多段小剧本：狗狗之间、小人和狗狗、早晚和特别的日子、岛和程序坞……不用管。
- **喂饭和拉粑粑**：到点小人会自己喂；吃完过一会儿，狗狗会在屏幕左下角或右下角上厕所，小人马上收拾。
  她可以点碗或粑粑帮忙，小人会谢谢她。不想要就在菜单里关掉"小人自动喂饭""狗狗会拉粑粑"。
- 夜里（默认 0 点到 7 点）它们回岛里睡觉，点一下岛就出来。
- 菜单栏右上角的 **🎾**：丢球、开饭、打招呼、回岛 / 出来、自动丢球、自动喂饭、拉粑粑、满屏幕跑（关掉就只在底部活动）、
  显示灵动岛、**桌面草地**（整个桌面 / 只在底部一条 / 不要）、大小、开机自动启动、先躲起来、退出。
  在小人或小狗身上点右键也能打开同一个菜单。
- 除了小人、小狗、小球、岛和偶尔可以点的小东西，其他地方鼠标会直接穿过去，不会挡住她用电脑。
- 默认不会出现在全屏的 App 上面。

## install.sh 会在这台 Mac 上放什么

| 位置 | 内容 |
|---|---|
| `build/QiuQiu.app`（这个文件夹里） | 编译出来的 App（本机签名，带"允许即时编译"那一条，JavaScript 才跑得快） |
| `/Applications/QiuQiu.app`（没有写入权限时是 `~/Applications/QiuQiu.app`） | 安装好的 App |
| `~/Library/LaunchAgents/local.qiuqiu.deskpet.plist` | 只有选了开机自动启动才有 |
| `defaults` 里的 `local.qiuqiu.deskpet` | 几个小设定（大小、开关、草地样式……）和"今天丢了几次球、吃了几顿"这类小数据 |

卸载：`bash uninstall.sh`（会把上面这些都清掉）。

## 文件说明

| 文件 | 作用 |
|---|---|
| `web/config.js` | 可以改的设定：颜色、小人说的话、两地时间、见面的日子、纪念日、开饭时间、多热闹…… |
| `web/dogs.js` / `web/person.js` / `web/fx.js` / `web/lawn.js` | 两只狗、小人、小东西、草地的画法（都是程序现画的像素） |
| `web/pet.js` | 玩法引擎；开头有"怎么写一场戏"，教怎么加新的小剧本 |
| `web/needs.js` | 什么时候饿、什么时候要上厕所 |
| `web/scenes/*.js` | 一段一段的小剧本 |
| `src/*.swift` | Mac 程序：`App.swift` 启动和屏幕、`Engine.swift` / `Glue.swift` 跑 JavaScript、`Stage.swift` 画图层、`Island.swift` 灵动岛、`Lawn.swift` 桌面草地、`Input.swift` 鼠标、`Menu.swift` 菜单和三种语言、`Sense.swift` 屏幕睡醒和她多久没碰电脑、`SelfTest.swift` 自检 |
| `install.sh` / `uninstall.sh` / `get.sh` | 安装 / 卸载 / 一行命令安装 |
| `web/index.html` 等 | 浏览器预览（直接用浏览器打开就能看） |
| `dev/` | 开发时用的测试脚本，安装用不到 |

改了 `web/` 或 `src/` 里的东西之后，重新运行一次 `bash install.sh` 就会生效。

## 遇到问题时

- **编译报错**：`src/` 里只用到 AppKit、QuartzCore、JavaScriptCore 和 IOKit，请直接修。
  这份代码在 macOS 15（Swift 6.1）、macOS 26（Swift 6.3）和 macOS 27（Swift 6.4）的云端 Mac 上编译通过。
- **看不到小人和狗**：用 `QiuQiu --debug` 在终端里启动，看 `ENGINE loaded=...` 那一行（应该读到了 `pet.js` 和 `scenes/` 里的文件）
  以及有没有 `JS EXCEPTION`（会写出是哪个文件第几行）。自检最后不是 `SELFTEST PASS` 时，前面几行会说原因。
- **动得一卡一卡 / 风扇响**：看自检里的 `SELFTEST jit`。是 `slow` 的话，说明签名里"允许即时编译"那一条没生效：
  重新运行 `bash install.sh`（它会带着 `com.apple.security.cs.allow-jit` 重新本机签名）。程序自己也会在慢的时候少画几帧。
- **顶上看不到那颗岛**：窗口必须比系统菜单栏高一层。层级在 `App.swift` 里设（`panel.level`，要写在 `isFloatingPanel` 后面）。
  可以用 `QIUQIU_LEVEL=数字` 这个环境变量临时换一层试试。
- **岛挡住了某个 App 很长的菜单 / 菜单栏图标**：🎾 → 取消勾选「显示灵动岛」。
- **桌面草地盖住了壁纸，她更想看壁纸**：🎾 → 桌面草地 →「只在底部一条」或「不要草地」。
- **它们挡住了她要点的东西**：把它拎走；或者 🎾 → 取消勾选「满屏幕到处跑」；或者「回岛睡觉」；或者「先躲起来」。
- **不想要拉粑粑 / 自动喂饭**：🎾 里取消勾选；或者在 `web/config.js` 的 `care` 里改，再 `bash install.sh`。
- **想换颜色、加几句话、写上纪念日**：改 `web/config.js`，然后 `bash install.sh`。
- **提示"已损坏"或"无法验证开发者"**：正常情况下不会出现，因为 App 是在这台 Mac 上现编译、本机签名的。
  如果出现，重新运行 `bash install.sh` 即可。

## 还没有在真机上验证过的地方（请留意）

- **带刘海的 MacBook 屏幕**：岛的位置和宽度是按系统给的刘海尺寸算的（`App.swift` 的 `readGeometry()`、`Island.swift`），
  但只在没有刘海的云端 Mac 上实际看过。如果岛和刘海没对齐，从这两处改。
- **耗电**：云端虚拟机上大约占一个核的 7–12%、内存 130–150 MB；真机上的情况没量过。
- **外接多个屏幕**、**Intel 的 Mac**、**真正重启后的开机自动启动**。
