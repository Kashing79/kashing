# 球球（QiuQiu）· 给 Claude Code 的说明

你好。这个文件夹是别人送给这台 Mac 主人的一份小礼物：一个离线的桌面宠物。

装好以后，屏幕最上面正中间（菜单栏里 / 刘海那里）会出现一颗黑色的小"岛"，
一个穿西装的像素小人、一只小腊肠、一只大金毛会从岛里跳出来，在整个屏幕上到处跑、玩球。
小人会丢球给狗狗追；她也可以用鼠标拖住小球甩出去。

它完全在本机运行：**不联网、没有 API、不需要任何系统权限、不用 sudo**。
跟她说话时，请用她平常跟你说话的语言。

## 她说"帮我安装"时

1. **先看一眼要运行的东西**（都不长）：`install.sh` 和 `src/main.swift`。
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

   想更确定，可以跑自检。它会给画面拍一张图，并检查背景是否透明：

   ```bash
   APP=/Applications/QiuQiu.app; [ -d "$APP" ] || APP="$HOME/Applications/QiuQiu.app"
   "$APP/Contents/MacOS/QiuQiu" --selftest /tmp/qiuqiu.png   # 最后一行应该是 SELFTEST PASS
   ```

   然后可以打开 `/tmp/qiuqiu.png` 看一眼。
5. **告诉她怎么玩**（见下一节）。

## 怎么玩

- 它们在**整个屏幕**上活动（不会走到菜单栏和 Dock 上）。
- **拖住小球甩出去**，狗狗会去追，再叼回来给小人。
- **点小人**，他会帮忙丢球。平时他自己也会隔一阵子丢几个。
- **点小狗**，摸摸它。**按住拖走**可以把小人或小狗拎到别的地方。
- 把它拎到顶上的**岛**上放开：大家回岛睡觉。
- 鼠标移到岛上，岛会展开：丢球 / 摸摸 / 集合 / 回岛睡觉（在岛里时是"出来玩"）。
- 它们平时还会自己玩：互相追、闻一闻、挤在一起睡、握手、发零食、散步……不用管。
- 夜里（默认 0 点到 7 点）它们会回岛里睡觉，点一下岛就出来。
- 菜单栏右上角的 **🎾**：丢球、打招呼、回岛 / 出来、开关自动丢球、**满屏幕到处跑**（关掉就只在屏幕底部活动）、
  **显示灵动岛**、调大小、开机自动启动、先躲起来、退出。
  在小人或小狗身上点右键也能打开同一个菜单。
- 除了小人、小狗、小球和岛，其他地方鼠标会直接穿过去，不会挡住她用电脑。
- 默认不会出现在全屏的 App 上面。

## install.sh 会在这台 Mac 上放什么

| 位置 | 内容 |
|---|---|
| `build/QiuQiu.app`（这个文件夹里） | 编译出来的 App |
| `/Applications/QiuQiu.app`（没有写入权限时是 `~/Applications/QiuQiu.app`） | 安装好的 App |
| `~/Library/LaunchAgents/local.qiuqiu.deskpet.plist` | 只有选了开机自动启动才有 |
| `defaults` 里的 `local.qiuqiu.deskpet` | 几个小设定：大小、是否自动丢球、是否满屏幕跑、是否显示岛、在哪个屏幕 |
| `~/Library/WebKit/local.qiuqiu.deskpet`、`~/Library/Caches/local.qiuqiu.deskpet`、`~/Library/HTTPStorages/local.qiuqiu.deskpet` | 系统网页引擎运行时自动建的小数据（"今天丢了几次球"记在这里），不是 install.sh 放的 |

卸载：`bash uninstall.sh`（会把上面这些都清掉）。

## 文件说明

| 文件 | 作用 |
|---|---|
| `web/config.js` | 可以改的设定：小人的发色肤色西装颜色、小腊肠毛色、小人偶尔说的话、多久丢一次球、夜里几点睡、岛上的两地时间和见面倒数 |
| `web/dogs.js` | 两只狗的画法：一副会动的骨架，每一帧现画成像素 |
| `web/pet.js` | 玩法逻辑和所有互动 |
| `web/island.js` | 屏幕顶上的岛 |
| `web/sprites.js` | 小人、小球、爱心等像素画（每个字符是一个像素） |
| `web/index.html` | 页面。直接用浏览器打开可以预览 |
| `src/main.swift` | Mac 外壳：铺满屏幕的透明置顶窗口、鼠标穿透、菜单栏图标 |
| `install.sh` / `uninstall.sh` | 安装 / 卸载 |
| `dev/` | 开发时用的测试脚本，安装用不到 |

改了 `web/` 或 `src/` 里的东西之后，重新运行一次 `bash install.sh` 就会生效。

## 遇到问题时

- **编译报错**：`src/main.swift` 不长，只用到 AppKit 和 WebKit，请直接修。
  这份代码在 macOS 15（Swift 6.1）、macOS 26（Swift 6.3）和 macOS 27（Swift 6.4）的云端 Mac 上编译通过。
- **整个屏幕蒙上一层不透明的白色或灰色**：说明这个系统版本上网页背景没能变透明。
  相关代码在 `src/main.swift` 的 `buildWindow()` 里（`drawsBackground` 那几行）。
  先用菜单栏 🎾 →「先躲起来」或「退出」（或 `pkill -x QiuQiu`），不要让它挡着她用电脑。
- **看得到岛，但看不到小人和狗**（或者自检最后是 `SELFTEST FAIL … hasPets=false`）：
  小人和狗都画在网页的画布上；这说明这台 Mac 上系统默认的"显卡画布"画不出东西。
  程序启动时会自己检查并自动换成不用显卡的画法（终端里用 `QiuQiu --debug` 启动能看到 `CANVAS …` 那一行）。
  如果自动切换没生效，可以手动指定：`defaults write local.qiuqiu.deskpet softCanvas -bool true`，然后重新打开 App。
  相关代码在 `src/main.swift` 的 `makeWebView()` 和 `web/pet.js` 最后的 `canvasOK()`。
- **顶上看不到那颗岛**：窗口必须比系统菜单栏高一层才能画在菜单栏上。
  层级在 `buildWindow()` 里设（`panel.level`，要写在 `isFloatingPanel` 后面）。
  可以用 `QIUQIU_LEVEL=数字` 这个环境变量临时换一层试试。
- **岛挡住了某个 App 很长的菜单 / 菜单栏图标**：🎾 → 取消勾选「显示灵动岛」。
- **它们挡住了她要点的东西**：把它拎走；或者 🎾 → 取消勾选「满屏幕到处跑」（只在屏幕底部活动）；
  或者 🎾 →「回岛睡觉」。
- **小球点不到 / 拖不动**：鼠标的判断在 `src/main.swift` 的 `tick()` 和 `forwardMouse()` 里。
  可以用 `QiuQiu --debug` 在终端里启动，它会打印窗口位置、可点区域和收到的鼠标事件。
- **想换颜色、加几句话**：改 `web/config.js`，然后 `bash install.sh`。
- **提示"已损坏"或"无法验证开发者"**：正常情况下不会出现，因为 App 是在这台 Mac 上现编译的。
  如果出现，重新运行 `bash install.sh` 即可（它会重新编译并做本机签名）。

## 还没有在真机上验证过的地方（请留意）

- **带刘海的 MacBook 屏幕**：岛的位置和宽度是按系统给的刘海尺寸算的，但只在没有刘海的云端 Mac 上实际看过。
  如果岛和刘海没对齐，尺寸在 `src/main.swift` 的 `pushConfig()`（`notchW`、`barH`）和 `web/island.js` 的 `size()` 里。
- **外接多个屏幕**、**Intel 的 Mac**、**真正重启后的开机自动启动**。
