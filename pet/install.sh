#!/bin/bash
# 球球 · 安装脚本
#
# 这个脚本做的事（不联网、不用 sudo、不改系统设置）：
#   1. 用这台 Mac 自带的 swiftc，把 src/main.swift 编译成一个小程序
#   2. 把 web/ 里的像素画和玩法放进去，组成 QiuQiu.app
#   3. 放到 /Applications（没有写入权限就放到 ~/Applications）
#   4. 打开它
#
# 用法：
#   bash install.sh               编译 + 安装 + 打开
#   bash install.sh --autostart   同上，并设成开机自动启动
#   bash install.sh --build-only  只编译到 build/，不安装
#   bash install.sh --no-open     安装但不打开

set -euo pipefail
cd "$(dirname "$0")"

APP_NAME="QiuQiu"
BUNDLE_ID="local.qiuqiu.deskpet"
VERSION="1.0.0"
MIN_MACOS="11.0"

BUILD_ONLY=0
AUTOSTART=0
NO_OPEN=0
for arg in "$@"; do
  case "$arg" in
    --build-only) BUILD_ONLY=1 ;;
    --autostart)  AUTOSTART=1 ;;
    --no-open)    NO_OPEN=1 ;;
    -h|--help)    sed -n '2,16p' "$0"; exit 0 ;;
    *) echo "不认识的参数：$arg"; exit 2 ;;
  esac
done

if [ "$(uname -s)" != "Darwin" ]; then
  echo "这个脚本只能在 Mac 上运行。"
  exit 1
fi

# ---- 1. 检查编译器 ----
if ! xcode-select -p >/dev/null 2>&1 || ! xcrun --find swiftc >/dev/null 2>&1; then
  cat <<'EOF'
找不到 Swift 编译器（swiftc）。它包含在苹果免费的 "Command Line Tools" 里。

请先运行下面这行，在弹出的窗口里点「安装」，等它装完（要几分钟）：

    xcode-select --install

装好之后再运行一次： bash install.sh
EOF
  exit 3
fi

for f in src/main.swift web/index.html web/pet.js web/sprites.js web/config.js; do
  if [ ! -f "$f" ]; then echo "缺少文件：$f（请确认整个文件夹都拷过来了）"; exit 1; fi
done

# ---- 2. 编译 ----
BUILD="build"
APP="$BUILD/$APP_NAME.app"
ARCH="$(uname -m)"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

echo "正在编译（$ARCH）……"
xcrun swiftc -O \
  -target "${ARCH}-apple-macos${MIN_MACOS}" \
  -o "$APP/Contents/MacOS/$APP_NAME" \
  src/main.swift

cp -R web "$APP/Contents/Resources/web"
if [ -f assets/AppIcon.icns ]; then cp assets/AppIcon.icns "$APP/Contents/Resources/AppIcon.icns"; fi

cat > "$APP/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>$APP_NAME</string>
  <key>CFBundleDisplayName</key><string>球球</string>
  <key>CFBundleIdentifier</key><string>$BUNDLE_ID</string>
  <key>CFBundleExecutable</key><string>$APP_NAME</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>$VERSION</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
  <key>LSMinimumSystemVersion</key><string>$MIN_MACOS</string>
  <key>LSUIElement</key><true/>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSHumanReadableCopyright</key><string>Made with love.</string>
</dict>
</plist>
EOF
printf 'APPL????' > "$APP/Contents/PkgInfo"

# 这是在本机刚编译出来的程序：清掉拷贝文件时带过来的附加属性，再做一个本机签名
xattr -cr "$APP" 2>/dev/null || true
codesign --force --sign - "$APP" >/dev/null 2>&1 || true

echo "编译完成：$(pwd)/$APP"
if [ "$BUILD_ONLY" = "1" ]; then exit 0; fi

# ---- 3. 安装 ----
DEST="/Applications"
if [ ! -w "$DEST" ]; then DEST="$HOME/Applications"; mkdir -p "$DEST"; fi

pkill -x "$APP_NAME" 2>/dev/null || true
sleep 0.5
rm -rf "$DEST/$APP_NAME.app"
ditto "$APP" "$DEST/$APP_NAME.app"
xattr -cr "$DEST/$APP_NAME.app" 2>/dev/null || true
codesign --force --sign - "$DEST/$APP_NAME.app" >/dev/null 2>&1 || true
echo "已安装到：$DEST/$APP_NAME.app"

# ---- 开机自动启动（可选）----
AGENT="$HOME/Library/LaunchAgents/$BUNDLE_ID.plist"
if [ "$AUTOSTART" = "1" ] || [ -f "$AGENT" ]; then
  mkdir -p "$HOME/Library/LaunchAgents"
  cat > "$AGENT" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$BUNDLE_ID</string>
  <key>ProgramArguments</key>
  <array><string>$DEST/$APP_NAME.app/Contents/MacOS/$APP_NAME</string></array>
  <key>RunAtLoad</key><true/>
  <key>ProcessType</key><string>Interactive</string>
  <key>LimitLoadToSessionType</key><string>Aqua</string>
</dict>
</plist>
EOF
  echo "已设成开机自动启动（菜单栏 🎾 里可以随时关掉）。"
fi

# ---- 4. 打开 ----
if [ "$NO_OPEN" = "0" ]; then
  open "$DEST/$APP_NAME.app"
  echo
  echo "好了！看屏幕最下面：穿西装的小人、小腊肠和大金毛已经在那儿了。"
  echo "  · 拖住小球甩出去，狗狗会去追"
  echo "  · 点小人，他会帮你丢球"
  echo "  · 点小狗，摸摸它"
  echo "  · 菜单栏右上角的 🎾 可以调大小、隐藏、退出"
fi
