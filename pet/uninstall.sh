#!/bin/bash
# 球球 · 卸载脚本：关掉程序，删掉 App、开机启动项、它存的几个小设定，
# 以及系统网页引擎替它建的小数据文件夹（"今天丢了几次球"记在那里）。
set -u

APP_NAME="QiuQiu"
BUNDLE_ID="local.qiuqiu.deskpet"

pkill -x "$APP_NAME" 2>/dev/null || true
sleep 0.5
rm -rf "/Applications/$APP_NAME.app" "$HOME/Applications/$APP_NAME.app"
rm -f "$HOME/Library/LaunchAgents/$BUNDLE_ID.plist"
defaults delete "$BUNDLE_ID" >/dev/null 2>&1 || true
rm -rf "$HOME/Library/WebKit/$BUNDLE_ID" \
       "$HOME/Library/Caches/$BUNDLE_ID" \
       "$HOME/Library/HTTPStorages/$BUNDLE_ID" \
       "$HOME/Library/HTTPStorages/$BUNDLE_ID.binarycookies" \
       "$HOME/Library/Saved Application State/$BUNDLE_ID.savedState" 2>/dev/null || true

echo "已卸载。（这个文件夹本身没有动，想彻底清掉的话直接把它丢进废纸篓。）"
