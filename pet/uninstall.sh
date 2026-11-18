#!/bin/bash
# 球球 · 卸载脚本：关掉程序，删掉 App、开机启动项和它存的三个小设定。
set -u

APP_NAME="QiuQiu"
BUNDLE_ID="local.qiuqiu.deskpet"

pkill -x "$APP_NAME" 2>/dev/null || true
rm -rf "/Applications/$APP_NAME.app" "$HOME/Applications/$APP_NAME.app"
rm -f "$HOME/Library/LaunchAgents/$BUNDLE_ID.plist"
defaults delete "$BUNDLE_ID" >/dev/null 2>&1 || true

echo "已卸载。（这个文件夹本身没有动，想彻底清掉的话直接把它丢进废纸篓。）"
